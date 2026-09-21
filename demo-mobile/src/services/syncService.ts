import { offlineStorage, PendingRecord } from '../storage/offlineStorage';
import { apiClient } from '../api/apiClient';

class SyncService {

    private syncing = false;

    /**
     * Sincroniza registros pendientes cuando vuelve internet
     */
    async syncPendingRecords(): Promise<void> {

        if (this.syncing) return;

        if (!offlineStorage.isOnline()) {
            console.log('[Sync] Sin internet');
            return;
        }

        this.syncing = true;

        try {

            const pendingRecords =
                await offlineStorage.getPendingRecords();


            if (pendingRecords.length === 0) {
                console.log('[Sync] No hay registros pendientes');
                return;
            }


            console.log(
                `[Sync] Sincronizando ${pendingRecords.length} registros`
            );


            for (const record of pendingRecords) {

                try {

                    await this.processRecord(record);

                    await offlineStorage.removePendingRecord(
                        record.id
                    );


                    console.log(
                        `[Sync] Registro sincronizado ${record.id}`
                    );


                } catch (error) {

                    console.error(
                        `[Sync] Error sincronizando ${record.id}`,
                        error
                    );

                }

            }


        } finally {

            this.syncing = false;

        }
    }


    private async processRecord(
        record: PendingRecord
    ): Promise<void> {


        switch (record.operation) {


            case 'CREATE':

                await apiClient.create(
                    record.endpoint,
                    record.data
                );

                break;


            case 'UPDATE':

                if (record.targetId) {

                    await apiClient.update(
                        record.endpoint,
                        record.targetId,
                        record.data
                    );

                }

                break;


            case 'DELETE':

                if (record.targetId) {

                    await apiClient.delete(
                        record.endpoint,
                        record.targetId
                    );

                }

                break;

        }

    }

}


export const syncService = new SyncService();