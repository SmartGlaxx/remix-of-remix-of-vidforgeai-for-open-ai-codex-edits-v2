Apply the explainer_exports Supabase migration, then deploy one persistent CPU container using the repository root as the build context:

    docker build -f explainer-worker/Dockerfile -t capscify-explainers .
    docker run -d --restart unless-stopped --shm-size=1g --env-file /secure/capscify-worker.env capscify-explainers

The server environment needs EXPLAINER_BRIDGE_URL (https://tsujvxpnpthjzkgpxmdv.supabase.co/functions/v1/explainer-bridge) and EXPLAINER_WORKER_TOKEN (the same value saved in the app's backend secrets). No service-role key is needed on the host. The project must have the existing film-media private bucket with owner-folder reads, and generate-script, generate-visual and generate-speech deployed. Set the bucket upload size limit to accommodate the selected film lengths and provision local temporary disk for all chapter clips and the final MP4. The worker uses these existing providers. Generating spends provider credit.

Verify with a signed-in 30-second job: submit, close the tab, check the database row advances, reopen the same format and play/download the MP4. A completed asset or scene is checkpointed. After a worker interruption its lease expires in five minutes. An ambiguous paid submission pauses for operator reconciliation in the attention state. Character Animation continues through the existing character-film worker and its own deployment.

## Hosting and credential requirements

Run this as one always-on Docker container on a Linux CPU VPS (for example, a Hetzner Cloud VM), or an equivalent persistent background-worker container service. It is not a Vite frontend process, a short-lived edge function, or a RunPod Serverless handler. The Lovable editing sandbox is temporary and cannot host it durably.

The worker reaches the backend only through the authenticated explainer-bridge function, which claims jobs, saves lease-checked progress, proxies the three generation functions and issues short-lived signed upload/download URLs scoped to the job's folder.

Before enabling paid work, verify the container startup log, backend connection, claim RPC, lease renewal, private film-media uploads and the three provider functions. Then authorize one real 30-second job, close the browser, confirm it finishes, reopen the job and play its final MP4. A working claim RPC or saved held test job alone does not prove the export worker is deployed or the factory is complete.
