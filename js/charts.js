/**
 * FinFlow - Charts Engine (Canvas & SVG based, zero-dependency, ultra crisp & responsive)
 * Safe against zero/hidden canvas dimensions and negative radius
 */

class FinCharts {
  static setupCanvasDPI(canvas) {
    if (!canvas) return { ctx: null, width: 0, height: 0 };
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 0;
    const height = rect.height || canvas.clientHeight || 0;

    // Guard against hidden canvas (display: none)
    if (width <= 10 || height <= 10) {
      return { ctx: null, width: 0, height: 0 };
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ctx: null, width: 0, height: 0 };

    ctx.scale(dpr, dpr);
    return { ctx, width, height };
  }

  /**
   * Cash Flow Bar Chart: Income vs Expense by Month or Date
   */
  static renderCashFlowChart(canvasId, data) {
    try {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const { ctx, width, height } = this.setupCanvasDPI(canvas);
      if (!ctx || width <= 10 || height <= 10) return;

      ctx.clearRect(0, 0, width, height);

      if (!data || data.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Belum ada data transaksi', width / 2, height / 2);
        return;
      }

      const padding = { top: 25, right: 15, bottom: 35, left: 60 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;
      if (chartW <= 10 || chartH <= 10) return;

      // Find max value
      let maxVal = 0;
      data.forEach(d => {
        maxVal = Math.max(maxVal, d.income, d.expense);
      });
      maxVal = maxVal === 0 ? 1000000 : maxVal * 1.15; // margin at top

      // Y-axis gridlines (Soft Rose grid)
      const steps = 4;
      ctx.strokeStyle = 'rgba(225, 29, 72, 0.08)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';

      for (let i = 0; i <= steps; i++) {
        const yVal = (maxVal / steps) * i;
        const y = padding.top + chartH - (i / steps) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Label
        let label = (yVal / 1000000).toFixed(1) + 'M';
        if (yVal < 1000000) label = (yVal / 1000).toFixed(0) + 'k';
        if (yVal === 0) label = '0';
        ctx.fillText(label, padding.left - 8, y + 4);
      }

      // Bars
      const groupWidth = chartW / data.length;
      const barWidth = Math.max(4, Math.min(22, (groupWidth - 14) / 2));

      data.forEach((d, idx) => {
        const groupX = padding.left + idx * groupWidth;
        const centerX = groupX + groupWidth / 2;

        // Income Bar (Green)
        const incH = Math.max(0, (d.income / maxVal) * chartH);
        const incX = centerX - barWidth - 2;
        const incY = padding.top + chartH - incH;

        const incGrad = ctx.createLinearGradient(0, incY, 0, padding.top + chartH);
        incGrad.addColorStop(0, '#10b981');
        incGrad.addColorStop(1, '#059669');
        ctx.fillStyle = incGrad;
        this.drawRoundedRect(ctx, incX, incY, barWidth, incH, 4);

        // Expense Bar (Rp 100.000 Red Gradient)
        const expH = Math.max(0, (d.expense / maxVal) * chartH);
        const expX = centerX + 2;
        const expY = padding.top + chartH - expH;

        const expGrad = ctx.createLinearGradient(0, expY, 0, padding.top + chartH);
        expGrad.addColorStop(0, '#f43f5e');
        expGrad.addColorStop(1, '#be123c');
        ctx.fillStyle = expGrad;
        this.drawRoundedRect(ctx, expX, expY, barWidth, expH, 4);

        // X-axis label
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.font = '600 11px sans-serif';
        ctx.fillText(d.label, centerX, height - 10);
      });
    } catch (err) {
      console.warn('FinCharts renderCashFlowChart caught error:', err);
    }
  }

  /**
   * Donut Chart with interactive look for allocations & categories
   */
  static renderDonutChart(canvasId, slices, options = {}) {
    try {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const { ctx, width, height } = this.setupCanvasDPI(canvas);
      if (!ctx || width <= 10 || height <= 10) return;

      ctx.clearRect(0, 0, width, height);

      const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

      if (total <= 0 || slices.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tidak ada data alokasi', width / 2, height / 2);
        return;
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 15;

      // Absolute safety check: Never invoke arc with radius <= 0
      if (radius <= 5) return;

      const innerRadius = Math.max(2, radius * 0.65);
      let startAngle = -Math.PI / 2;

      slices.forEach(slice => {
        if (!slice.value || slice.value <= 0) return;
        const sliceAngle = (slice.value / total) * (Math.PI * 2);
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = slice.color || '#6366f1';
        ctx.fill();

        // Clean white separator border between slices
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        startAngle = endAngle;
      });

      // Center hole background (pure white)
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(1, innerRadius - 2), 0, Math.PI * 2);
      ctx.fillStyle = options.holeColor || '#ffffff';
      ctx.fill();

      // Center text
      if (options.centerTitle || options.centerValue) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (options.centerTitle) {
          ctx.fillStyle = '#64748b';
          ctx.font = '600 11px -apple-system, sans-serif';
          ctx.fillText(options.centerTitle, centerX, centerY - 10);
        }

        if (options.centerValue) {
          ctx.fillStyle = '#881337';
          ctx.font = 'bold 15px -apple-system, sans-serif';
          ctx.fillText(options.centerValue, centerX, centerY + 10);
        }
      }
    } catch (err) {
      console.warn('FinCharts renderDonutChart caught error:', err);
    }
  }

  static drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height <= 0 || width <= 0) return;
    radius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
}

window.FinCharts = FinCharts;
