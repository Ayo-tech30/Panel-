// frontend/components/StatusBadge.js

export default function StatusBadge({ status, pm2Status }) {
  const effective = pm2Status || status || 'stopped';

  const map = {
    online: { cls: 'badge-green', label: 'Online' },
    running: { cls: 'badge-green', label: 'Running' },
    stopped: { cls: 'badge-gray', label: 'Stopped' },
    stopping: { cls: 'badge-yellow', label: 'Stopping' },
    crashed: { cls: 'badge-red', label: 'Crashed' },
    errored: { cls: 'badge-red', label: 'Error' },
    pending: { cls: 'badge-yellow', label: 'Pending' },
  };

  const { cls, label } = map[effective] || map.stopped;

  return (
    <span className={cls}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${effective === 'online' || effective === 'running' ? 'bg-accent animate-pulse' : 'bg-current'}`} />
      {label}
    </span>
  );
}
