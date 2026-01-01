import { pool } from '@/lib/db';

/**
 * DeploymentLogger
 * 
 * Utility to log deployment events, migrations, and major system changes
 * to the deployment_logs table for the SuperAdmin Dashboard.
 */
export class DeploymentLogger {
    /**
     * Log a new deployment event
     */
    async logDeployment(data: {
        name: string;
        type: 'feature' | 'hotfix' | 'integration' | 'config';
        mode?: 'production' | 'test';
        status?: 'pending' | 'in_progress' | 'success' | 'failed' | 'partial';
        targetWorkspaces?: string[];
        deployedBy?: string;
        metadata?: any;
        errorMessage?: string;
    }) {
        try {
            const { data: deployment, error } = await supabase
                .from('deployment_logs')
                .insert({
                    deployment_name: data.name,
                    deployment_type: data.type,
                    deployment_mode: data.mode || 'production',
                    status: data.status || 'success',
                    target_workspaces: data.targetWorkspaces,
                    target_count: data.targetWorkspaces?.length || null,
                    deployed_by: data.deployedBy,
                    metadata: data.metadata || {},
                    error_message: data.errorMessage,
                    started_at: new Date().toISOString(),
                    completed_at: data.status === 'success' || data.status === 'failed' ? new Date().toISOString() : null,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            console.log(`🚀 Deployment logged: ${data.name} (${deployment.id})`);
            return deployment.id;
        } catch (error) {
            console.error('❌ Failed to log deployment:', error);
            return null;
        }
    }

    /**
     * Update an existing deployment log (e.g. from in_progress to success)
     */
    async updateStatus(id: string, update: {
        status: 'success' | 'failed' | 'partial';
        successCount?: number;
        failureCount?: number;
        errorMessage?: string;
        metadata?: any;
    }) {
        try {
            const { error } = await supabase
                .from('deployment_logs')
                .update({
                    status: update.status,
                    success_count: update.successCount,
                    failure_count: update.failureCount,
                    error_message: update.errorMessage,
                    completed_at: new Date().toISOString(),
                    metadata: update.metadata,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            console.log(`✅ Deployment updated: ${id} -> ${update.status}`);
        } catch (error) {
            console.error('❌ Failed to update deployment log:', error);
        }
    }
}

export const deploymentLogger = new DeploymentLogger();
