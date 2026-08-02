# SecureDeploy - Kubernetes Security Implementation

## Overview
This document describes the Kubernetes security scanning and policy configurations added to SecureDeploy.

## Technologies Added

### 1. Grype
- Container vulnerability scanning
- Anchore security scanner

### 2. Syft
- SBOM generation
- Software composition analysis

### 3. Kube-bench
- CIS Kubernetes benchmark
- Security compliance checks

### 4. OPA Gatekeeper
- Policy-as-code
- Admission control policies

### 5. Falco
- Runtime security monitoring
- Behavioral analysis

## Files Created

### Grype
- `grype/grype-config.yaml` - Grype vulnerability scanning configuration and cron job

### Syft
- `syft/syft-config.yaml` - Syft SBOM generation configuration and cron job

### Kube-bench
- `kube-bench/kube-bench-config.yaml` - CIS benchmark scanning configuration

### OPA Gatekeeper
- `opa/gatekeeper-config.yaml` - Gatekeeper installation and constraint templates

### Falco
- `falco/falco-config.yaml` - Falco daemonset, RBAC, and custom security rules

## Features

### Grype
- Scheduled vulnerability scanning
- Configurable severity thresholds
- Fail on critical vulnerabilities
- Support for multiple image registries

### Syft
- SBOM generation in JSON format
- Multi-layer container scanning
- Scheduled scanning via cron job
- Output to persistent storage

### Kube-bench
- CIS Kubernetes benchmark compliance
- Host-mounted volume access
- Configurable check skipping
- JSON report generation

### OPA Gatekeeper
- Policy-as-code enforcement
- Required labels constraint
- Disallowed image tags constraint
- Namespace exclusion support

### Falco
- Runtime security monitoring
- Shell access detection
- Crypto mining detection
- System call monitoring
- Kubernetes-aware rules

## Usage

### Apply Grype
```bash
kubectl apply -f grype/grype-config.yaml
```

### Apply Syft
```bash
kubectl apply -f syft/syft-config.yaml
```

### Apply Kube-bench
```bash
kubectl apply -f kube-bench/kube-bench-config.yaml
```

### Apply OPA Gatekeeper
```bash
kubectl apply -f opa/gatekeeper-config.yaml
```

### Apply Falco
```bash
kubectl apply -f falco/falco-config.yaml
```

## Notes
- All configurations are Kubernetes manifests
- No package installation required
- Requires running Kubernetes cluster
- Grype and Syft require container registry access
- Kube-bench requires host access
- Gatekeeper requires OPA integration
- Falco requires privileged containers
