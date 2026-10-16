# Prepare NVIDIA GPU + KAITO

Local inference uses stock KAITO and vLLM, not a CPU llama.cpp server.
Foundry-only deployments do not require a GPU. Hybrid deployments require both
this local path and [gateway workload identity](../../docs/agents/native-radius.md#models).
Use the existing portfolio, Radius and OIDC preparation; do not install another
model gateway or agent operator.

## 1. Prepare a real GPU node

Use an existing GPU-capable K3s/AKS/Kubernetes cluster. Native agents require
Kubernetes 1.33+. On host K3s, install the appropriate NVIDIA driver and container
toolkit before K3s starts so its containerd can discover `nvidia-container-runtime`.
Verify `nvidia-smi` and the configured NVIDIA runtime. Restarting an existing
cluster is a separately scoped operation, not part of ordinary model delivery.

GPU availability on the host does not imply availability inside k3d. An ordinary
CLI-created k3d cluster does not install NVIDIA support. Container-based nodes
need a compatible GPU-enabled image, Docker's NVIDIA runtime, GPU passthrough
and, on WSL, the actual driver libraries/device. The older custom
`assets/gpu/Dockerfile.nvidia` is a trading-sample asset, not a qualified native
Kubernetes 1.33+ bootstrap. Do not replace a working cluster to follow that path.

### Fresh WSL2 Ubuntu: host K3s without Docker

Host K3s includes containerd; Docker Desktop, Docker Engine and k3d are not
required to run this cluster. Image builds are separate: use the documented
[Podman build/import workflow](../../docs/agents/native-radius.md#docker-free-image-builds-for-host-k3s)
with `CONTAINER_ENGINE=podman`; this cluster setup alone does not install a builder.

Use this path only for a fresh, dedicated development distro. It is not an
upgrade or ownership-handover procedure. Check for an existing K3s installation
before proceeding:

```bash
command -v k3s
systemctl is-active k3s
sudo ls -ld /etc/rancher/k3s /var/lib/rancher/k3s
```

Missing commands/directories and an inactive service are expected on a fresh
distro. If any installation exists, stop and review its ownership rather than
overwriting it.

WSL must use systemd (`ps -p 1 -o comm=` must report `systemd`), and
`nvidia-smi` must detect the real GPU. Install the NVIDIA driver on **Windows**;
do not install a Linux display driver inside WSL. Check available RAM, disk
space and GPU memory first. Prefer SSD-backed distro storage and keep cluster
data on the Linux filesystem, not `/mnt/c`.

On WSL, `nvidia-smi` normally resides at `/usr/lib/wsl/lib/nvidia-smi`.
If it works in your user shell but not under `sudo`, use that absolute path:
sudo's restricted PATH may omit `/usr/lib/wsl/lib`. This does not mean a Linux
driver needs to be installed.

Install NVIDIA Container Toolkit **before** K3s so K3s can discover the runtime.
The following commands use NVIDIA's official apt repository; review any
existing repository/keyring configuration before changing it:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gpg
sudo install -d -m 0755 /usr/share/keyrings
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey |
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list |
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' |
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list >/dev/null
sudo apt update
sudo apt install -y nvidia-container-toolkit
command -v nvidia-container-runtime
```

For a small single-node distro, create this configuration only after confirming
there is no existing installation:

```bash
sudo install -d -m 0755 /etc/rancher/k3s
sudo tee /etc/rancher/k3s/config.yaml >/dev/null <<'EOF'
disable:
  - traefik
write-kubeconfig-mode: "0600"
kubelet-arg:
  - "serialize-image-pulls=true"
  - "container-log-max-size=10Mi"
  - "container-log-max-files=3"
  - "system-reserved=cpu=500m,memory=1Gi"
  - "kube-reserved=cpu=500m,memory=1Gi"
EOF
sudo chmod 0600 /etc/rancher/k3s/config.yaml

mkdir -p build/bootstrap
curl -fsSL https://get.k3s.io -o build/bootstrap/get-k3s.sh
# Review the downloaded installer before running it as root.
less build/bootstrap/get-k3s.sh
sudo env INSTALL_K3S_VERSION=v1.35.5+k3s1 sh build/bootstrap/get-k3s.sh
sudo k3s kubectl wait --for=condition=Ready node --all --timeout=180s
sudo k3s kubectl get nodes -o wide
```

This disables bundled Traefik so native Envoy remains separately owned, while
retaining K3s's default networking, NetworkPolicy controller and local storage.
Kubelet image pulls are serialized and container logs rotate at 10Mi with three
files. The reservations subtract 2Gi RAM and one CPU from pod allocatable
capacity; they are scheduling reservations, not a hard host-memory or IOPS cap.
They do not limit concurrent image imports/builds or model downloads.
No model, KAITO Workspace or agent is created by these commands.

Select the new cluster without replacing an existing user kubeconfig:

```bash
mkdir -p .adaptive/access
chmod 0700 .adaptive/access
sudo install -m 0600 -o "$(id -u)" -g "$(id -g)" \
  /etc/rancher/k3s/k3s.yaml .adaptive/access/k3s.yaml
export KUBECONFIG="$PWD/.adaptive/access/k3s.yaml"
export PATH="/usr/local/bin:$PATH"
kubectl get nodes
kubectl get runtimeclass nvidia
```

The kubeconfig is an administrator credential; keep it private and never commit
it. If `kubectl` is unavailable, use `sudo k3s kubectl` until the Linux CLI is
available. If the NVIDIA RuntimeClass is missing, inspect K3s's runtime discovery
and service logs before continuing. Do not install a second Docker/containerd
daemon to fix K3s runtime configuration.

K3s's bundled `kubectl` may warn about permission denied on
`/etc/rancher/k3s/config.yaml.d` if the parent directory was created with mode
0700. Set the directory to 0755 with `sudo chmod 0755 /etc/rancher/k3s`;
keep `config.yaml`, `k3s.yaml` and the private kubeconfig copy at mode 0600.
Do not use recursive permission changes.

Continue with the device-plugin and CUDA validation below, then install KAITO.
Use `--platform k8s` for subsequent `ada bootstrap` against this existing host
K3s cluster, not `--platform k3s` (which selects CLI-created k3d). Apply the
[small-development Helm override](../getting-started/README.md#native-agent-application-choice)
when bootstrapping the portfolio. GPU validation, actual model inference and
live resource monitoring are required; these instructions and source tests do
not establish live capacity or WSL GPU compatibility.

## 2. Install the shared device plugin

Do not install a second plugin if the cluster already supplies one. For BYO
K3s with an NVIDIA container runtime:

```bash
kubectl apply -f tutorials/common/assets/gpu/device-plugin-daemonset.yaml
kubectl rollout status daemonset/nvidia-device-plugin-daemonset \
  -n kube-system --timeout=180s
kubectl get nodes -o custom-columns='NAME:.metadata.name,GPU:.status.allocatable.nvidia\.com/gpu'
./tutorials/common/assets/gpu/validate_gpu.sh
```

The CUDA validation Pod must finish **Succeeded**. Failures retain the Pod for
diagnosis; remove that exact test Pod before retrying. The device plugin fails
explicitly when initialization is unavailable.

### Device plugin cannot create an FS watcher

If the plugin logs `failed to create FS watcher ... too many open files`,
Kubernetes can report zero allocatable GPUs even when host `nvidia-smi` works.
GPU model Pods then remain Pending with `Insufficient nvidia.com/gpu`, and the
gateway reports connection errors for the local model.

Check `fs.inotify.max_user_instances` and `fs.inotify.max_user_watches` with
`sysctl`. A low per-user instance limit (for example 128) is shared by host
processes and containers using the same host UID. The message alone does not
distinguish instance exhaustion from a process file-descriptor limit; inspect
the plugin logs and limits before changing unrelated settings.

For a host with the low instance limit, review existing sysctl overrides and
raise that limit persistently in the WSL distro:

```bash
sudoedit /etc/sysctl.d/90-adaptive-inotify.conf
# File content: fs.inotify.max_user_instances = 1024
sudo sysctl -p /etc/sysctl.d/90-adaptive-inotify.conf
kubectl -n kube-system rollout restart daemonset/nvidia-device-plugin-daemonset
kubectl -n kube-system rollout status daemonset/nvidia-device-plugin-daemonset --timeout=180s
kubectl get nodes -o custom-columns='NAME:.metadata.name,GPU:.status.allocatable.nvidia\.com/gpu'
```

Verify the GPU returns and the existing model becomes Ready, then test an
actual gateway request. No K3s restart, model replacement, cache deletion or
cloud fallback is required for this repair. If the watcher error persists,
inspect root-owned inotify consumers and the plugin's open-file limit rather
than repeatedly increasing limits.

## 3. Label only verified GPU facts

Select the actual node name and set the selector used in the model declaration:

```bash
kubectl label node <gpu-node> nvidia.com/gpu=true --overwrite
```

KAITO presets may additionally need truthful product, count and memory labels
when GPU Feature Discovery cannot supply them, particularly on WSL. Measure
these with `nvidia-smi`; never inflate GPU memory or remove validation webhooks
to make an unsuitable model schedule.

## 4. Install stock KAITO on BYO nodes

```bash
helm repo add kaito https://kaito-project.github.io/kaito/charts/kaito
helm repo update kaito
helm upgrade --install kaito-workspace kaito/workspace \
  --version 0.10.0 --namespace kaito-workspace --create-namespace \
  --set featureGates.disableNodeAutoProvisioning=true \
  --set nvidiaDevicePlugin.enabled=false \
  --set localCSIDriver.useLocalCSIDriver=false \
  --wait --timeout=10m
kubectl get deployments -n kaito-workspace
kubectl get crd workspaces.kaito.sh
```

The native recipe's custom Workspace sets `runtimeClassName: nvidia` itself.
**Kyverno is not required for native inference.** The separate
`assets/gpu/gpu_bootstrap.yaml` contains only the optional trading-preset
runtime-class mutation policy; apply it only where Kyverno is already installed
and that preset needs the mutation.

## 5. Declare the small GPU model through Radius

`ada agents-config --with-kaito-model` selects **Qwen/Qwen3-0.6B**, an exact
model revision and pinned vLLM image through the explicit `kaito` model recipe.
KAITO is off by default for every portfolio. Native `ada init` consumes explicit `models`, then the
normal bootstrap deploys them through `radius/agent-services.bicep`.
Alternatively, `radius/agent-models.bicep` declares independently owned local
and Foundry `aiModels` resources plus an `aiGateways` hybrid route built from
their real Radius outputs.

The smoke profile requests one GPU, a retained HF cache, 2048-token context,
one sequence and 30% GPU utilization. It is a small serving test, not a tool
quality or production-capacity claim. Image/model downloads require internet;
disconnected restart requires the image and exact weights to be present.
Do not change agent images or call the KAITO Service from application clients:
all calls and discovery still use the authenticated LiteLLM gateway.

```bash
kubectl get workspaces,pods,pvc -n <namespace>
kubectl describe workspace <model-resource-name> -n <namespace>
kubectl logs -n <namespace> <inference-pod> -c vllm
```

Confirm serving readiness and perform real inference through the model gateway
before retiring an earlier model. Preserve retained caches unless their deletion
is explicitly scoped.

KAITO 0.10.0 did not propagate a changed custom template into an existing
StatefulSet in the local qualification. Compare the desired Workspace and actual
StatefulSet container arguments; Workspace generation alone is not rollout
evidence. For an explicitly scoped update, stop and delete only that
KAITO-generated StatefulSet with foreground cascading, retaining the Workspace
and external HF-cache PVC, then wait for KAITO to recreate the desired singleton:

```bash
kubectl delete statefulset <model-resource-name> -n <namespace> \
  --cascade=foreground --wait=true --timeout=180s
kubectl wait --for=create statefulset/<model-resource-name> \
  -n <namespace> --timeout=180s
kubectl rollout status statefulset/<model-resource-name> \
  -n <namespace> --timeout=600s
kubectl wait --for=condition=InferenceReady workspace/<model-resource-name> \
  -n <namespace> --timeout=600s
kubectl get statefulset <model-resource-name> -n <namespace> \
  -o jsonpath='{.spec.template.spec.containers[0].args}'
```

Verify the recreated Pod and actual arguments as well as current Workspace
readiness. This operation interrupts serving; do not force-delete a Pod or
delete the cache to obtain an update.
