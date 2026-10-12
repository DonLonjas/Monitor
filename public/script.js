const MAX_POINTS = 60;
const charts = {};

if (window.Chart && Chart.defaults) {
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
}

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, index)).toFixed(index > 1 ? 2 : 1) + ' ' + units[index];
}

function fmtBytesPerSec(bytes) {
  return fmtBytes(bytes) + '/s';
}

function fmtUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

function fmtGhz(value) {
  if (value == null || Number.isNaN(value)) return '--';
  return Number(value).toFixed(2) + ' GHz';
}

function fmtPct(value) {
  if (value == null || Number.isNaN(value)) return '--';
  return Number(value).toFixed(1) + '%';
}

function fmtTemp(value) {
  if (value == null || Number.isNaN(value)) return '--';
  return Number(value).toFixed(1) + '°C';
}

function fmtPower(value) {
  if (value == null || Number.isNaN(value)) return '--';
  return Number(value).toFixed(1) + ' W';
}

function setBar(id, pct) {
  const element = document.getElementById(id);
  if (!element) return;
  element.style.width = Math.min(100, Math.max(0, pct)) + '%';
  element.classList.remove('warn', 'danger');
  if (pct >= 90) element.classList.add('danger');
  else if (pct >= 70) element.classList.add('warn');
}

function getGaugeColor(pct) {
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warn';
  return '';
}

function setGauge(id, pct) {
  const fg = document.getElementById(id);
  if (!fg) return;
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (pct / 100) * circumference;
  fg.style.strokeDashoffset = offset;
  fg.classList.remove('warn', 'danger');
  const cls = getGaugeColor(pct);
  if (cls) fg.classList.add(cls);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setConnection(online, text) {
  const label = document.getElementById('connectionText');
  if (label) label.classList.toggle('offline', !online);
  setText('connectionText', text);
}

function updateCores(perCore) {
  const wrap = document.getElementById('cores');
  if (!wrap || !Array.isArray(perCore)) return;

  if (wrap.children.length !== perCore.length) {
    wrap.innerHTML = '';
    perCore.forEach((_, index) => {
      const core = document.createElement('div');
      core.className = 'core';
      core.innerHTML = `
        <div class="core-bar"><div class="core-fill"></div></div>
        <span>C${index}</span>
      `;
      wrap.appendChild(core);
    });
  }

  perCore.forEach((load, index) => {
    const fill = wrap.children[index] && wrap.children[index].querySelector('.core-fill');
    if (!fill) return;
    fill.style.height = Math.min(100, Math.max(0, load)) + '%';
    fill.classList.remove('warn', 'danger');
    if (load >= 90) fill.classList.add('danger');
    else if (load >= 70) fill.classList.add('warn');
  });
}

function renderDisks(disks, filesystems) {
  const fsWrap = document.getElementById('diskContent');
  const physicalWrap = document.getElementById('physicalDiskContent');
  if (!fsWrap || !physicalWrap) return;

  let fsHtml = '';
  if (Array.isArray(filesystems) && filesystems.length > 0) {
    filesystems.forEach(fs => {
      const pct = fs.use || 0;
      const cls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
      fsHtml += `
        <div class="disk-item">
          <div class="disk-item-head">
            <span>${fs.mount} <span class="badge">${fs.type || ''}</span></span>
            <span>${fmtBytes(fs.used)} / ${fmtBytes(fs.size)}</span>
          </div>
          <div class="disk-bar"><div class="disk-bar-fill ${cls}" style="width:${pct}%"></div></div>
          <div class="disk-detail">${pct.toFixed(1)}% usado · ${fs.fs}</div>
        </div>
      `;
    });
  }
  fsWrap.innerHTML = fsHtml || '<div class="placeholder">Sin filesystems detectados</div>';

  let physicalHtml = '';
  if (Array.isArray(disks) && disks.length > 0) {
    disks.forEach(disk => {
      const temp = disk.temperature != null ? `${disk.temperature}°C` : 'N/D';
      physicalHtml += `
        <div class="disk-item">
          <div class="disk-item-head">
            <span>${disk.name || 'Disk'} <span class="badge">${disk.type || ''}</span></span>
            <span>${fmtBytes(disk.size)} · ${temp}</span>
          </div>
        </div>
      `;
    });
  }
  physicalWrap.innerHTML = physicalHtml || '<div class="placeholder">Sin discos físicos detectados</div>';
}

function renderNet(interfaces, rxSec, txSec) {
  setText('netRx', fmtBytesPerSec(rxSec));
  setText('netTx', fmtBytesPerSec(txSec));
  const list = document.getElementById('netList');
  if (!list) return;

  if (!Array.isArray(interfaces) || interfaces.length === 0) {
    list.innerHTML = '<div class="placeholder">Sin interfaces de red</div>';
    return;
  }

  list.innerHTML = interfaces
    .slice()
    .sort((left, right) => (right.rxSec + right.txSec) - (left.rxSec + left.txSec))
    .map(net => `
      <div class="net-item">
        <div class="net-item-head">
          <span>${net.iface}</span>
          <span>↓ ${fmtBytesPerSec(net.rxSec)} ↑ ${fmtBytesPerSec(net.txSec)}</span>
        </div>
        <div class="net-item-stats">Total: ↓ ${fmtBytes(net.rxBytes)} ↑ ${fmtBytes(net.txBytes)}</div>
      </div>
    `).join('');
}

function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function makeChart(id, label, color, colorVar) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const dataset = {
    label,
    data: [],
    borderColor: color,
    backgroundColor: chartGradient(ctx, color),
    borderWidth: 2,
    fill: true,
    tension: 0.3,
    pointRadius: 0
  };
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [dataset]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true }
      }
    }
  });
  chart._colorVar = colorVar;
  return chart;
}

function chartGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 120);
  gradient.addColorStop(0, color + '66');
  gradient.addColorStop(1, color + '00');
  return gradient;
}

function pushPoint(chart, value) {
  if (!chart) return;
  chart.data.labels.push('');
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}

function initCharts() {
  charts.cpu = makeChart('cpuHistory', 'CPU', themeColor('--acento'), '--acento');
  charts.mem = makeChart('memHistory', 'RAM', themeColor('--acento'), '--acento');
  charts.swap = makeChart('swapHistory', 'Swap', themeColor('--suave'), '--suave');
  charts.disk = makeChart('diskHistory', 'Disk', themeColor('--acento'), '--acento');
  charts.netDown = makeChart('netHistoryDown', 'Download', themeColor('--acento'), '--acento');
  charts.netUp = makeChart('netHistoryUp', 'Upload', themeColor('--suave'), '--suave');

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(entries => {
      Object.values(charts).forEach(chart => {
        if (chart && chart.resize) chart.resize();
      });
    });
    document.querySelectorAll('.chart-wrap').forEach(wrap => resizeObserver.observe(wrap));
  }
}

function recolorCharts() {
  Object.values(charts).forEach(chart => {
    if (!chart) return;
    const color = themeColor(chart._colorVar);
    const dataset = chart.data.datasets[0];
    dataset.borderColor = color;
    dataset.backgroundColor = chartGradient(chart.ctx, color);
    chart.update('none');
  });
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    recolorCharts();
  });
}

async function fetchMetrics() {
  try {
    const response = await fetch('/api/metrics');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const metrics = await response.json();
    render(metrics);
    setConnection(true, 'En línea');
  } catch (error) {
    setConnection(false, 'Sin conexión');
    console.error(error);
  }
}

function render(metrics) {
  setText('hostInfo', `${metrics.hostname} · ${metrics.os}`);
  const avatar = document.getElementById('hostAvatar');
  if (avatar && metrics.hostname) {
    avatar.textContent = metrics.hostname.trim()[0].toUpperCase();
  }
  setText('uptime', fmtUptime(metrics.uptime));
  setText('sysHost', metrics.hostname);
  setText('sysOs', metrics.os);
  setText('sysKernel', metrics.kernel);
  setText('sysArch', metrics.arch);

  const cpu = metrics.cpu || {};
  const cpuLoad = Number(cpu.load || 0);
  const perCore = Array.isArray(cpu.loadPerCore) ? cpu.loadPerCore : [];
  const averageCoreLoad = perCore.length > 0
    ? perCore.reduce((sum, value) => sum + value, 0) / perCore.length
    : cpuLoad;

  setText('cpuModel', `${cpu.brand || ''}`.trim() || 'CPU');
  setText('cpuLoad', cpuLoad.toFixed(1));
  setText('cpuCores', `${cpu.physicalCores || '--'}P / ${cpu.cores || '--'}L`);
  setText('cpuSpeed', fmtGhz(cpu.currentSpeed || cpu.speed));
  setText('cpuSpeedAlt', fmtGhz(cpu.currentSpeed || cpu.speed));
  setText('cpuTemp', fmtTemp(cpu.temp));
  setText('cpuTempAlt', fmtTemp(cpu.temp));
  setText('cpuPerCoreAvg', fmtPct(averageCoreLoad));
  setGauge('cpuGaugeFg', cpuLoad);
  updateCores(perCore);
  pushPoint(charts.cpu, cpuLoad);

  setText('heroCpu', cpuLoad.toFixed(1) + '%');

  const memory = metrics.memory || {};
  const totalMemory = memory.total || 1;
  const usedMemory = memory.used || 0;
  const memPct = (usedMemory / totalMemory) * 100;
  const totalSwap = memory.swapTotal || 0;
  const usedSwap = memory.swapUsed || 0;
  const swapPct = totalSwap > 0 ? (usedSwap / totalSwap) * 100 : 0;

  setText('ramUsed', fmtBytes(usedMemory));
  setText('ramTotal', fmtBytes(totalMemory));
  setText('ramPct', memPct.toFixed(1) + '%');
  setText('ramUsedVal', fmtBytes(usedMemory));
  setText('ramFreeVal', fmtBytes(memory.free || 0));
  setText('ramTotalVal', fmtBytes(totalMemory));
  setText('swapVal', `${fmtBytes(usedSwap)} / ${fmtBytes(totalSwap)}`);
  setText('swapFreeVal', fmtBytes(Math.max(0, totalSwap - usedSwap)));
  setBar('ramBar', memPct);
  pushPoint(charts.mem, memPct);
  pushPoint(charts.swap, swapPct);

  setText('heroRam', memPct.toFixed(1) + '%');

  renderDisks(metrics.disk, metrics.filesystem);
  renderNet(metrics.network && metrics.network.interfaces, metrics.network && metrics.network.rxSec || 0, metrics.network && metrics.network.txSec || 0);

  const diskUse = Array.isArray(metrics.filesystem) && metrics.filesystem.length > 0
    ? metrics.filesystem.reduce((sum, fs) => sum + (fs.use || 0), 0) / metrics.filesystem.length
    : 0;
  const netDownMb = ((metrics.network && metrics.network.rxSec) || 0) / (1024 * 1024);
  const netUpMb = ((metrics.network && metrics.network.txSec) || 0) / (1024 * 1024);

  pushPoint(charts.disk, diskUse);
  pushPoint(charts.netDown, netDownMb);
  pushPoint(charts.netUp, netUpMb);

  const batteryWrap = document.getElementById('batteryInfo');
  if (batteryWrap) {
    if (metrics.battery) {
      batteryWrap.classList.remove('hidden');
      setText('batteryPct', metrics.battery.percent + '%');
      setText('batteryStatus', metrics.battery.isCharging ? '⚡ Cargando' : 'Descargando');
      setText('batteryTime', metrics.battery.timeRemaining || '--');
      setBar('batteryBar', metrics.battery.percent);
    } else {
      batteryWrap.classList.add('hidden');
    }
  }

  setText('lastUpdate', 'Última actualización: ' + new Date().toLocaleTimeString());
}

initCharts();
setConnection(false, 'Conectando');
fetchMetrics();
setInterval(fetchMetrics, 2000);
