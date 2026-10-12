const express = require('express');
const path = require('path');
const si = require('systeminformation');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let prevCpu = null;
let prevNet = null;

app.get('/api/metrics', async (req, res) => {
  try {
    const [cpu, cpuLoad, mem, gpu, disk, fsSize, net, osInfo, cpuTemp, battery, currentLoad] = await Promise.all([
      si.cpu(),
      si.cpuCurrentSpeed(),
      si.mem(),
      safe(si.graphics),
      safe(si.diskLayout),
      safe(si.fsSize),
      si.networkStats(),
      si.osInfo(),
      safe(si.cpuTemperature),
      safe(si.battery),
      si.currentLoad()
    ]);

    const netRx = net.reduce((acc, n) => acc + (n.rx_sec || 0), 0);
    const netTx = net.reduce((acc, n) => acc + (n.tx_sec || 0), 0);

    const metrics = {
      timestamp: Date.now(),
      hostname: osInfo.hostname,
      os: `${osInfo.distro} ${osInfo.release}`,
      kernel: osInfo.kernel,
      arch: osInfo.arch,
      uptime: os.uptime(),
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        currentSpeed: cpuLoad.avg,
        load: currentLoad.currentLoad,
        loadPerCore: currentLoad.cpus.map(c => c.load),
        temp: cpuTemp.main || cpuTemp.max || null
      },
      memory: {
        total: mem.total,
        used: mem.active || mem.used,
        free: mem.available || mem.free,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused
      },
      gpu: Array.isArray(gpu) ? gpu.map(g => ({
        vendor: g.vendor,
        model: g.model,
        vram: g.vram || null,
        temperatureGpu: g.temperatureGpu || null,
        utilizationGpu: g.utilizationGpu || null,
        memoryUsed: g.memoryUsed || null,
        memoryTotal: g.memoryTotal || null,
        powerDraw: g.powerDraw || null
      })) : [],
      disk: Array.isArray(disk) ? disk.map(d => ({
        name: d.name,
        type: d.type,
        size: d.size,
        temperature: d.temperature || null
      })) : [],
      filesystem: Array.isArray(fsSize) ? fsSize.filter(f => f.type !== 'squashfs').map(f => ({
        fs: f.fs,
        type: f.type,
        size: f.size,
        used: f.used,
        use: f.use,
        mount: f.mount
      })) : [],
      network: {
        rxSec: netRx,
        txSec: netTx,
        interfaces: net.map(n => ({
          iface: n.iface,
          rxSec: n.rx_sec,
          txSec: n.tx_sec,
          rxBytes: n.rx_bytes,
          txBytes: n.tx_bytes
        }))
      },
      battery: battery && battery.hasBattery ? {
        percent: battery.percent,
        isCharging: battery.isCharging,
        timeRemaining: battery.timeRemaining
      } : null
    };

    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function safe(fn) {
  try {
    return await fn();
  } catch (e) {
    return null;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🖥️  System Monitor corriendo en puerto ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
