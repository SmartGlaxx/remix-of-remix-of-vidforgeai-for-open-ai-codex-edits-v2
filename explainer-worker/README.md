Apply the explainer_exports Supabase migration, then deploy one persistent CPU container using the repository root as the build context:

    docker build -f explainer-worker/Dockerfile -t capscify-explainers .
    docker run -d --restart unless-stopped --shm-size=1g --env-file /secure/capscify-worker.env capscify-explainers

The server environment needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The project must have the existing film-media private bucket with owner-folder reads, and generate-script, generate-visual and generate-speech deployed. Set the bucket upload size limit to accommodate the selected film lengths and provision local temporary disk for all chapter clips and the final MP4. The worker uses these existing providers. Generating spends provider credit.

Verify with a signed-in 30-second job: submit, close the tab, check the database row advances, reopen the same format and play/download the MP4. A completed asset or scene is checkpointed. After a worker interruption its lease expires in five minutes. An ambiguous paid submission pauses for operator reconciliation in the attention state. Character Animation continues through the existing character-film worker and its own deployment.

## Hosting and credential requirements

Run this as one always-on Docker container on a Linux CPU VPS (for example, a Hetzner Cloud VM), or an equivalent persistent background-worker container service. It is not a Vite frontend process, a short-lived edge function, or a RunPod Serverless handler. The Lovable editing sandbox is temporary and cannot host it durably.

The current worker requires a privileged backend credential provisioned securely on that host, and the URL must identify the same backend as the app. Lovable Cloud does not expose its managed service-role key to project owners; do not ask an owner to retrieve it, copy sandbox credentials to a host, use a publishable key as a substitute, or weaken RLS. If the hosting environment cannot be securely provisioned with backend access, an authenticated server-side worker bridge must be implemented before this container can run there; that bridge is not included in the current deployment.

Before enabling paid work, verify the container startup log, backend connection, claim RPC, lease renewal, private film-media uploads and the three provider functions. Then authorize one real 30-second job, close the browser, confirm it finishes, reopen the job and play its final MP4. A working claim RPC or saved held test job alone does not prove the export worker is deployed or the factory is complete.
