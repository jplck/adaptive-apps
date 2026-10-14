package main

import (
	"fmt"
	"net/http/httptest"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ktesting "k8s.io/client-go/testing"
)

func addRelease(t *testing.T, f fixture, version string) {
	t.Helper()
	snapshot := f.snapshot.DeepCopy()
	snapshot.SetName("snapshot-" + version)
	snapshot.SetUID(types.UID("snapshot-" + version))
	snapshot.SetAnnotations(map[string]string{"radius.resource.id": "/radius/agentReleases/demo-" + version})
	doc := document(snapshot)
	doc["version"], doc["workload"], doc["claim"] = version, "demo-"+version, "state-"+version
	doc["radiusResourceId"] = snapshot.GetAnnotations()["radius.resource.id"]
	doc["endpoint"] = "https://adaptive.local/agents/demo/versions/" + version
	capture(snapshot, doc)
	if err := f.objects.Tracker().Create(configMaps, snapshot, "adaptive"); err != nil {
		t.Fatal(err)
	}
	for _, plural := range []string{"statefulsets", "services", "persistentvolumeclaims", "httproutes", "securitypolicies", "envoyextensionpolicies"} {
		name := "demo-v1"
		if plural == "persistentvolumeclaims" {
			name = "state-v1"
		}
		base, err := f.objects.Tracker().Get(resource(plural), "adaptive", name)
		if err != nil {
			t.Fatal(err)
		}
		obj := base.(*object).DeepCopy()
		obj.SetName("demo-" + version)
		if plural == "persistentvolumeclaims" {
			obj.SetName("state-" + version)
			obj.SetLabels(map[string]string{"adaptive.jplck.io/agent-uid": "agent-uid", "adaptive.jplck.io/version": version})
		} else {
			obj.SetOwnerReferences([]metav1.OwnerReference{{APIVersion: "v1", Kind: "ConfigMap",
				Name: snapshot.GetName(), UID: snapshot.GetUID()}})
			obj.SetAnnotations(snapshot.GetAnnotations())
		}
		if err := f.objects.Tracker().Create(resource(plural), obj, "adaptive"); err != nil {
			t.Fatal(err)
		}
	}
}

func TestInventoryReadCountDoesNotGrowWithRetainedReleases(t *testing.T) {
	for _, count := range []int{1, 20} {
		for _, path := range []string{"/v1/agents", "/v1/agents/demo/versions", "/v1/agents/demo/versions/v1"} {
			t.Run(fmt.Sprintf("%d-%s", count, path), func(t *testing.T) {
				f := newFixture(t)
				for n := 2; n <= count; n++ {
					addRelease(t, f, fmt.Sprintf("v%d", n))
				}
				if count > 1 {
					if err := f.objects.Tracker().Delete(resource("statefulsets"), "adaptive", "demo-v20"); err != nil {
						t.Fatal(err)
					}
				}
				result := request(t, f.api, "GET", path, "", 200)
				actions := f.objects.Actions()
				if len(actions) != 9 {
					t.Fatalf("inventory made %d Kubernetes calls, want 9 independent of retained release count", len(actions))
				}
				configLists := 0
				for _, action := range actions {
					if action.GetVerb() != "list" {
						t.Fatalf("inventory performed per-release %s", action.GetVerb())
					}
					if action.GetResource() == configMaps {
						configLists++
					}
				}
				if configLists != 2 {
					t.Fatal("capture/identity verification must use a second fresh ConfigMap list")
				}
				if path == "/v1/agents" {
					agent := result["data"].([]any)[0].(map[string]any)
					releases := agent["releases"].([]any)
					if len(releases) != count {
						t.Fatal("inline release inventory lost retained releases")
					}
				}
			})
		}
	}
}

func TestInventoryVerificationDetectsCaptureReplacement(t *testing.T) {
	f := newFixture(t)
	reads := 0
	f.objects.PrependReactor("list", "configmaps", func(ktesting.Action) (bool, runtime.Object, error) {
		reads++
		if reads == 2 {
			replacement := f.snapshot.DeepCopy()
			replacement.SetUID("replacement-uid")
			update(t, f, "configmaps", replacement)
		}
		return false, nil, nil
	})
	request(t, f.api, "GET", "/v1/agents/demo/versions/v1", "", 409)
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
	request(t, f.api, "GET", "/v1/agents/demo/versions/v1", "", 503)
}

func TestInventorySnapshotIsNotSharedAcrossRequests(t *testing.T) {
	f := newFixture(t)
	request(t, f.api, "GET", "/v1/agents/demo/versions/v1", "", 200)
	f.deployment.Object["status"].(map[string]any)["readyReplicas"] = int64(0)
	update(t, f, "statefulsets", f.deployment)
	view := request(t, f.api, "GET", "/v1/agents/demo/versions/v1", "", 200)
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
	f.deployment.SetOwnerReferences(nil)
	update(t, f, "statefulsets", f.deployment)
	if _, _, err := f.api.monitorServices(r); err == nil {
		t.Fatal("Monitor reused ownership from the preceding poll")
	}
}

func TestSelectedReleaseDoesNotQualifyUnrelatedRuntime(t *testing.T) {
	f := newFixture(t)
	addRelease(t, f, "v2")
	f.agent.Object["data"].(map[string]any)["activeVersion"] = "v2"
	update(t, f, "configmaps", f.agent)
	f.deployment.SetOwnerReferences(nil)
	update(t, f, "statefulsets", f.deployment)
	view := request(t, f.api, "GET", "/v1/agents/demo/versions/v2", "", 200)
	if view["phase"] != "Ready" || view["activeVersion"] != "v2" {
		t.Fatal("selected release readiness was lost")
	}
	request(t, f.api, "GET", "/v1/agents/demo/versions", "", 503)
}
