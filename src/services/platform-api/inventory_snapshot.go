package main

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type inventoryKey struct{}

// A fresh namespace snapshot is shared only within one HTTP request.
type inventorySnapshot struct {
	resources map[schema.GroupVersionResource][]object
	verified  []object
	checked   bool
}

func inventoryRequest(r *http.Request) *http.Request {
	snapshot := &inventorySnapshot{resources: map[schema.GroupVersionResource][]object{}}
	return r.WithContext(context.WithValue(r.Context(), inventoryKey{}, snapshot))
}

func (a *API) nativeResources(r *http.Request, gvr schema.GroupVersionResource, verify bool) ([]object, error) {
	snapshot, ok := r.Context().Value(inventoryKey{}).(*inventorySnapshot)
	if !ok {
		return nil, unavailable("Native inventory request scope is unavailable")
	}
	if verify && snapshot.checked {
		return snapshot.verified, nil
	}
	if !verify {
		if items, ok := snapshot.resources[gvr]; ok {
			return items, nil
		}
	}
	list, err := a.objects.Resource(gvr).Namespace(a.namespace).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	if verify {
		snapshot.verified = list.Items
		snapshot.checked = true
	} else {
		snapshot.resources[gvr] = list.Items
	}
	return list.Items, nil
}

func (a *API) nativeObject(r *http.Request, gvr schema.GroupVersionResource, name string, verify bool) (*object, error) {
	items, err := a.nativeResources(r, gvr, verify)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].GetName() == name {
			return &items[i], nil
		}
	}
	return nil, apierrors.NewNotFound(gvr.GroupResource(), name)
}
