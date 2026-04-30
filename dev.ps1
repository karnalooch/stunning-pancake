function Start-SportDev {
    Write-Host "[START] Uruchamiam SPORT Dev Engine v0.1.0-beta.1..." -ForegroundColor Green

# --- DODANE PRZEZ GEMINI CLI: AUTOMATYCZNE TUNELE ---
Write-Host "[INIT] Inicjalizacja tuneli (Port Forward)..." -ForegroundColor Cyan
Get-Job -Name PortForwardBackend, PortForwardOwner | Stop-Job -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
Start-Job -Name PortForwardBackend -ScriptBlock { kubectl port-forward service/sport-backend-service 8000:80 }
Start-Job -Name PortForwardOwner -ScriptBlock { kubectl port-forward service/sport-owner-service 8080:80 }
# ----------------------------------------------------

    $env:KIND_EXPERIMENTAL_PROVIDER = "podman"
    
    $lastHash = ""
    
    while($true) {
        # Szybki hash plików (pomijamy biblioteki dla prędkości)
        $currentHash = Get-ChildItem -Path "backend", "admin" -Recurse -Exclude "node_modules", "venv", "__pycache__", "dist", ".git" | 
                       Get-FileHash | Select-Object -ExpandProperty Hash | Out-String
        
        if ($currentHash -ne $lastHash) {
            Write-Host "[RELOAD] Wykryto zmiany! Przebudowuję platformę..." -ForegroundColor Yellow
            
            # Build Backend
            Write-Host "[BUILD] Buduję Backend..."
            podman build -t localhost/sport-backend:gold-master-v2.1 -f backend/Dockerfile backend
            
            # Build Owner (Admin)
            Write-Host "[BUILD] Buduję Owner Panel..."
            podman build -t localhost/sport-owner:gold-master-v2.1 -f admin/Dockerfile admin
            
            # Load do Kind
            Write-Host "[LOAD] Ładuję do klastra..."
            podman save -o dev-sync.tar localhost/sport-backend:gold-master-v2.1 localhost/sport-owner:gold-master-v2.1
            kind load image-archive dev-sync.tar --name kind-cluster
            Remove-Item dev-sync.tar
            
            # Apply K8s
            Write-Host "[K8S] Odświeżam Kubernetes..."
            kubectl apply -k infrastructure/kubernetes/base/
            kubectl rollout restart deployment sport-backend sport-owner
            
            $lastHash = $currentHash
            Write-Host "OK System gotowy. Czekam na zmiany..." -ForegroundColor Green
        }
        
        Start-Sleep -Seconds 3
    }
}

Start-SportDev
