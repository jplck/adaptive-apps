# Prepare a K3s Cluster

The k3d path below requires Docker and does not configure GPU passthrough.
For native agents on a fresh WSL2 distro without Docker, use
[host K3s with NVIDIA runtime](prepare-gpu-kaito.md#fresh-wsl2-ubuntu-host-k3s-without-docker)
instead. That path includes small-node settings and uses K3s's bundled
containerd; application image builds remain a separate prerequisite.

1. Install k3d:


    ```bash
    curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

    ```

2.  Verify installation:

    ```bash
    k3d --version
    ```

3. Create a K3s cluster:

    ```bash
    k3d cluster create k3s
    # Set K3D_FIX_DNS=0 helps cluster creation complete in environments where it otherwise stalls at configuring CoreDNS configmap
    ```
    
