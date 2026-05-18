import { RefreshCw, Clock, Zap } from 'lucide-react';

interface SyncSettingsProps {
    autoSync: boolean;
    syncInterval: number;
    lastSync: Date | null;
    queueCount: number;
    syncing: boolean;
    onToggleAutoSync: () => void;
    onChangeInterval: (seconds: number) => void;
    onSyncNow: () => void;
}

export const SyncSettings = ({
    autoSync,
    syncInterval,
    lastSync,
    queueCount,
    syncing,
    onToggleAutoSync,
    onChangeInterval,
    onSyncNow
}: SyncSettingsProps) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-500" />
                    Sincronización
                </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">Auto-sync</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Sincronizar automáticamente cada cierto tiempo
                        </p>
                    </div>
                    <button
                        onClick={onToggleAutoSync}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${autoSync ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoSync ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">Intervalo</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Cada cuántos segundos sincronizar
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={5}
                            max={3600}
                            step={5}
                            value={syncInterval}
                            disabled={!autoSync}
                            onChange={(e) => onChangeInterval(parseInt(e.target.value) || 5)}
                            className="w-20 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50 outline-none focus:ring-2 focus:ring-blue-500 text-center"
                        />
                        <span className="text-sm text-slate-500 dark:text-slate-400">seg</span>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Último sync</p>
                                <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                    {lastSync
                                        ? lastSync.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                        : 'Nunca'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Pendientes</p>
                                <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                    {queueCount} acciones
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onSyncNow}
                        disabled={syncing || autoSync}
                        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white disabled:text-slate-400 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : autoSync ? `Auto-sync cada ${syncInterval} seg` : 'Sincronizar ahora'}
                    </button>
                </div>
            </div>
        </div>
    );
};
