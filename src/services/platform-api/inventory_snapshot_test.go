package main

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"
	ktesting "k8s.io/client-go/testing"
)

func TestInventoryReadsAreBoundedAcrossAgents(t *testing.T) {
	for _, count := range []int{1, 20} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			f := newFixture(t)
			for n := 1; n < count; n++ {
				name := fmt.Sprintf("demo-%d", n)
				for _, item := range []struct{ plural, name string }{
					{"configmaps", "agent-demo"}, {"configmaps", "binding-demo"},
					{"statefulsets", "demo-v1"}, {"services", "demo-v1"},
					{"httproutes", "demo-v1"}, {"agentgatewaypolicies", "demo-v1"},
					{"persistentvolumeclaims", "state-v1"},
				} {
					base, err := f.objects.Tracker().Get(resource(item.plural), "adaptive", item.name)
					if err != nil {
						t.Fatal(err)
					}
					obj := base.(*object).DeepCopy()
					obj.SetName(name)
					switch item.name {
					case "agent-demo":
						obj.SetName("agent-" + name)
						obj.Object["data"] = map[string]any{
							"name": name, "kind": "prompt", "agentUid": name, "identityRef": "binding-" + name,
							"definition": `{"kind":"prompt","model":"local-chat"}`, "governance": "{}",
						}
					case "binding-demo":
						obj.SetName("binding-" + name)
						obj.Object["data"] = map[string]any{"identity.json": fmt.Sprintf(`{"ownerUid":%q}`, name)}
					}
					labels := obj.GetLabels()
					if labels == nil {
						labels = map[string]string{}
					}
					labels["adaptive.jplck.io/agent-uid"] = name
					obj.SetLabels(labels)
					if err := f.objects.Tracker().Create(resource(item.plural), obj, "adaptive"); err != nil {
						t.Fatal(err)
					}
				}
			}
			result := request(t, f.api, "GET", "/v1/agents", "", 200)
			if len(result["data"].([]any)) != count {
				t.Fatal("agent inventory lost a runtime")
			}
			if actions := f.objects.Actions(); len(actions) != 8 {
				t.Fatalf("inventory made %d Kubernetes calls, want 8 regardless of agent count", len(actions))
			}
		})
	}
}

func TestInventoryVerificationDetectsIdentityChange(t *testing.T) {
	f := newFixture(t)
	reads := 0
	f.objects.PrependReactor("list", "configmaps", func(ktesting.Action) (bool, runtime.Object, error) {
		reads++
		if reads == 2 {
			obj, err := f.objects.Tracker().Get(configMaps, "adaptive", "binding-demo")
			if err != nil {
				t.Fatal(err)
			}
			binding := obj.(*object).DeepCopy()
			binding.Object["data"] = map[string]any{"identity.json": `{"ownerUid":"foreign-agent"}`}
			update(t, f, "configmaps", binding)
		}
		return false, nil, nil
	})
	request(t, f.api, "GET", "/v1/agents/demo", "", 503)
}

func TestInventoryVerificationDetectsAgentChange(t *testing.T) {
	f := newFixture(t)
	reads := 0
	f.objects.PrependReactor("list", "configmaps", func(ktesting.Action) (bool, runtime.Object, error) {
		reads++
		if reads == 2 {
			changed := f.agent.DeepCopy()
			changed.Object["data"].(map[string]any)["definition"] = `{"instructions":"changed"}`
			update(t, f, "configmaps", changed)
		}
		return false, nil, nil
	})
	request(t, f.api, "GET", "/v1/agents/demo", "", 409)
}

func TestInventorySnapshotIsNotSharedAcrossRequests(t *testing.T) {
	f := newFixture(t)
	request(t, f.api, "GET", "/v1/agents/demo", "", 200)
	f.deployment.Object["status"].(map[string]any)["readyReplicas"] = int64(0)
	update(t, f, "statefulsets", f.deployment)
	view := request(t, f.api, "GET", "/v1/agents/demo", "", 200)
	if view["phase"] != "Pending" || view["endpoint"] != nil {
		t.Fatal("readiness from a previous request was reused")
	}
}

func TestMonitorSnapshotIsRefreshedWithinOneStreamingRequest(t *testing.T) {
	f := newFixture(t)
	r := httptest.NewRequest("GET", "/v1/agents/demo/spans", nil)
	r.SetPathValue("name", "demo")
	if _, _, err := f.api.monitorServices(r); err != nil {
		t.Fatal(err)
	}
	f.deployment.SetAnnotations(map[string]string{"radius.resource.id": "/foreign"})
	update(t, f, "statefulsets", f.deployment)
	if _, _, err := f.api.monitorServices(r); err == nil {
		t.Fatal("Monitor reused ownership from the preceding poll")
	}
}
