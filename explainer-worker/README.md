Apply the explainer_exports Supabase migration, then deploy one persistent CPU container using the repository root as the build context:

    docker build -f explainer-worker/Dockerfile -t capscify-explainers .
    docker run -d --restart unless-stopped --shm-size=1g --env-file /secure/capscify-worker.env capscify-explainers

The server environment needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The project must have the existing film-media private bucket with owner-folder reads, and generate-script, generate-visual and generate-speech deployed. Set the bucket upload size limit to accommodate the selected film lengths and provision local temporary disk for all chapter clips and the final MP4. The worker uses these existing providers. Generating spends provider credit.

Verify with a signed-in 30-second job: submit, close the tab, check the database row advances, reopen the same format and play/download the MP4. A completed asset or scene is checkpointed. After a worker interruption its lease expires in five minutes. An ambiguous paid submission pauses for operator reconciliation in the attention state. Character Animation continues through the existing character-film worker and its own deployment.
