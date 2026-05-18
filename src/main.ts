import "./style.css";

type PricePoint = {
  date: string;
  indexValue: number;
};

type InvestmentPoint = {
  date: string;
  indexValue: number;
  investedAmount: number;
  unitsHeld: number;
  portfolioValue: number;
  profit: number;
  profitRate: number;
  isContributionDay: boolean;
};

type SimulationState = {
  points: InvestmentPoint[];
  startDate: string;
  dailyAmount: number;
  warning: string | null;
};

type ChartLayout = {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  xPositions: number[];
};

const DEFAULT_DAILY_AMOUNT = 100;
const EARLIEST_SELECTABLE_DATE = "1999-01-01";
const SVG_NS = "http://www.w3.org/2000/svg";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

app.innerHTML = `
  <main class="page-shell">
    <section class="chart-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">NASDAQ 100</p>
          <h1>日定投收益静态可视化</h1>
        </div>
        <div class="dataset-meta" id="dataset-meta">加载中...</div>
      </div>
      <div class="chart-stage">
        <div class="status-overlay" id="chart-status">正在加载数据...</div>
        <svg id="chart" class="chart" aria-label="纳斯达克100价格走势图"></svg>
      </div>
    </section>
    <section class="control-panel">
      <div class="card form-card">
        <h2>定投参数</h2>
        <form id="controls" class="control-form">
          <label>
            <span>开始日期</span>
            <input id="start-date" name="start-date" type="date" required />
          </label>
          <label>
            <span>每日定投金额</span>
            <input id="daily-amount" name="daily-amount" type="number" min="0" step="1" required />
          </label>
          <button type="button" id="reset-button" class="secondary-button">重置</button>
        </form>
        <p class="form-hint" id="form-hint">从开始日期对应的首个可用交易日起，每个交易日买入一次。</p>
      </div>
      <div class="card summary-card">
        <h2>最新汇总</h2>
        <div class="metric-grid" id="summary-grid"></div>
      </div>
      <div class="card hover-card">
        <h2>当前指向</h2>
        <div class="metric-grid" id="hover-grid"></div>
      </div>
    </section>
  </main>
`;

const chart = document.querySelector<SVGSVGElement>("#chart");
const chartStage = document.querySelector<HTMLDivElement>(".chart-stage");
const chartStatus = document.querySelector<HTMLDivElement>("#chart-status");
const datasetMeta = document.querySelector<HTMLDivElement>("#dataset-meta");
const controlsForm = document.querySelector<HTMLFormElement>("#controls");
const startDateInput = document.querySelector<HTMLInputElement>("#start-date");
const dailyAmountInput = document.querySelector<HTMLInputElement>("#daily-amount");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button");
const formHint = document.querySelector<HTMLParagraphElement>("#form-hint");
const summaryGrid = document.querySelector<HTMLDivElement>("#summary-grid");
const hoverGrid = document.querySelector<HTMLDivElement>("#hover-grid");

if (
  !chart ||
  !chartStage ||
  !chartStatus ||
  !datasetMeta ||
  !controlsForm ||
  !startDateInput ||
  !dailyAmountInput ||
  !resetButton ||
  !formHint ||
  !summaryGrid ||
  !hoverGrid
) {
  throw new Error("Failed to initialize UI");
}

let priceSeries: PricePoint[] = [];
let currentSimulation: SimulationState | null = null;
let activeHoverIndex: number | null = null;
let currentChartLayout: ChartLayout | null = null;
let resizeObserver: ResizeObserver | null = null;

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    priceSeries = await loadPriceSeries();
    if (priceSeries.length === 0) {
      throw new Error("CSV 中没有可用数据");
    }

    const defaultStartDate = priceSeries[0].date;
    startDateInput.min = EARLIEST_SELECTABLE_DATE;
    startDateInput.max = priceSeries[priceSeries.length - 1].date;
    startDateInput.value = defaultStartDate;
    dailyAmountInput.value = String(DEFAULT_DAILY_AMOUNT);

    datasetMeta.textContent = `${priceSeries[0].date} 至 ${priceSeries[priceSeries.length - 1].date} · ${priceSeries.length} 个交易日`;
    controlsForm.addEventListener("input", handleInputsChanged);
    resetButton.addEventListener("click", handleReset);
    chart.addEventListener("pointermove", handleChartPointerMove);
    chart.addEventListener("pointerleave", handleChartPointerLeave);
    resizeObserver = new ResizeObserver(() => {
      if (currentSimulation) {
        renderChart(currentSimulation);
      }
    });
    resizeObserver.observe(chartStage);

    recomputeAndRender();
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据加载失败";
    chartStatus.textContent = message;
    chartStatus.classList.remove("is-hidden");
    formHint.textContent = message;
  }
}

async function loadPriceSeries(): Promise<PricePoint[]> {
  const csvUrl = new URL("NASDAQ100.csv", document.baseURI).toString();
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`读取 CSV 失败: ${response.status}`);
  }

  const csvText = await response.text();
  const parsedSeries = csvText
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","))
    .map(([date, value]) => ({
      date: date?.trim() ?? "",
      indexValue: Number(value),
    }))
    .filter((point) => point.date && Number.isFinite(point.indexValue));

  let previousIndexValue: number | null = null;
  return parsedSeries.map((point) => {
    if (point.indexValue === 0 && previousIndexValue !== null) {
      return {
        ...point,
        indexValue: previousIndexValue,
      };
    }

    previousIndexValue = point.indexValue;
    return point;
  });
}

function handleInputsChanged(): void {
  recomputeAndRender();
}

function handleReset(): void {
  startDateInput.value = priceSeries[0]?.date ?? "";
  dailyAmountInput.value = String(DEFAULT_DAILY_AMOUNT);
  recomputeAndRender();
}

function recomputeAndRender(): void {
  if (priceSeries.length === 0) {
    return;
  }

  const startDate = startDateInput.value;
  const dailyAmount = sanitizeDailyAmount(dailyAmountInput.value);
  dailyAmountInput.value = dailyAmount.toString();

  currentSimulation = runSimulation(priceSeries, startDate, dailyAmount);
  activeHoverIndex = currentSimulation.points.length > 0 ? currentSimulation.points.length - 1 : null;

  renderChart(currentSimulation);
  renderMetrics(currentSimulation);
}

function sanitizeDailyAmount(rawValue: string): number {
  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

function runSimulation(series: PricePoint[], startDate: string, dailyAmount: number): SimulationState {
  const startIndex = series.findIndex((point) => point.date >= startDate);

  if (startIndex === -1) {
    return {
      points: [],
      startDate,
      dailyAmount,
      warning: `开始日期 ${startDate} 晚于数据末尾，无法计算收益。`,
    };
  }

  let investedAmount = 0;
  let unitsHeld = 0;

  const points = series.map((point, index) => {
    const isContributionDay = index >= startIndex;
    if (isContributionDay && dailyAmount > 0) {
      investedAmount += dailyAmount;
      unitsHeld += dailyAmount / point.indexValue;
    }

    const portfolioValue = unitsHeld * point.indexValue;
    const profit = portfolioValue - investedAmount;
    const profitRate = investedAmount > 0 ? profit / investedAmount : 0;

    return {
      date: point.date,
      indexValue: point.indexValue,
      investedAmount,
      unitsHeld,
      portfolioValue,
      profit,
      profitRate,
      isContributionDay,
    };
  });

  const actualStartDate = series[startIndex]?.date ?? startDate;
  let warning: string | null = null;
  if (startDate < series[0].date) {
    warning = `输入日期早于数据起点，已从首个可用交易日 ${actualStartDate} 开始定投。`;
  } else if (actualStartDate !== startDate) {
    warning = `输入日期不是交易日，已从下一个交易日 ${actualStartDate} 开始定投。`;
  }

  return {
    points,
    startDate: actualStartDate,
    dailyAmount,
    warning,
  };
}

function renderChart(simulation: SimulationState): void {
  while (chart.firstChild) {
    chart.removeChild(chart.firstChild);
  }

  if (simulation.points.length === 0) {
    chartStatus.textContent = simulation.warning ?? "暂无可展示数据";
    chartStatus.classList.remove("is-hidden");
    return;
  }

  chartStatus.classList.add("is-hidden");

  const width = Math.max(chartStage.clientWidth, 320);
  const height = Math.max(chartStage.clientHeight, 240);
  chart.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const padding = {
    top: Math.max(22, height * 0.05),
    right: Math.max(18, width * 0.025),
    bottom: Math.max(40, height * 0.09),
    left: Math.max(62, width * 0.075),
  };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const minValue = Math.min(...simulation.points.map((point) => point.indexValue));
  const maxValue = Math.max(...simulation.points.map((point) => point.indexValue));
  const yMin = minValue * 0.97;
  const yMax = maxValue * 1.03;
  const lastIndex = simulation.points.length - 1;
  const domainStartDate = simulation.startDate < simulation.points[0].date ? simulation.startDate : simulation.points[0].date;
  const domainEndDate = simulation.points[lastIndex].date;
  const startTime = toUtcTimestamp(domainStartDate);
  const endTime = toUtcTimestamp(domainEndDate);
  const timeSpan = Math.max(endTime - startTime, 1);

  const xForDate = (date: string): number =>
    padding.left + (((toUtcTimestamp(date) - startTime) / timeSpan) * innerWidth);
  const yForValue = (value: number): number =>
    padding.top + ((yMax - value) / (yMax - yMin || 1)) * innerHeight;
  const xPositions = simulation.points.map((point) => xForDate(point.date));
  currentChartLayout = {
    width,
    height,
    plotLeft: padding.left,
    plotRight: width - padding.right,
    xPositions,
  };

  const defs = createSvgElement("defs");
  const gradient = createSvgElement("linearGradient", {
    id: "price-gradient",
    x1: "0%",
    y1: "0%",
    x2: "0%",
    y2: "100%",
  });
  gradient.append(
    createSvgElement("stop", { offset: "0%", "stop-color": "#f25f5c", "stop-opacity": "0.32" }),
    createSvgElement("stop", { offset: "100%", "stop-color": "#f25f5c", "stop-opacity": "0.02" }),
  );
  defs.appendChild(gradient);
  chart.appendChild(defs);

  const areaPath = simulation.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xPositions[index].toFixed(2)} ${yForValue(point.indexValue).toFixed(2)}`)
    .join(" ");
  const area = createSvgElement("path", {
    d: `${areaPath} L ${xPositions[lastIndex].toFixed(2)} ${(height - padding.bottom).toFixed(2)} L ${xPositions[0].toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`,
    fill: "url(#price-gradient)",
  });
  chart.appendChild(area);

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = yMin + ((yMax - yMin) * tick) / 4;
    const y = padding.top + innerHeight - (innerHeight * tick) / 4;
    chart.appendChild(
      createSvgElement("line", {
        x1: String(padding.left),
        y1: String(y),
        x2: String(width - padding.right),
        y2: String(y),
        class: "grid-line",
      }),
    );
    const label = createSvgElement("text", {
      x: String(padding.left - 14),
      y: String(y + 5),
      class: "axis-label",
      "text-anchor": "end",
    });
    label.textContent = formatIndexValue(value);
    chart.appendChild(label);
  }

  const line = createSvgElement("path", {
    d: areaPath,
    class: "price-line",
  });
  chart.appendChild(line);

  const xAxis = createSvgElement("line", {
    x1: String(padding.left),
    y1: String(height - padding.bottom),
    x2: String(width - padding.right),
    y2: String(height - padding.bottom),
    class: "axis-line",
  });
  chart.appendChild(xAxis);

  const dateTicks = [
    { label: domainStartDate, x: xForDate(domainStartDate), anchor: "start" },
    {
      label: formatMidDate(domainStartDate, domainEndDate),
      x: xForDate(formatMidDate(domainStartDate, domainEndDate)),
      anchor: "middle",
    },
    { label: domainEndDate, x: xForDate(domainEndDate), anchor: "end" },
  ];
  for (const tick of dateTicks) {
    const text = createSvgElement("text", {
      x: String(tick.x),
      y: String(height - 12),
      class: "axis-label",
      "text-anchor": tick.anchor,
    });
    text.textContent = tick.label;
    chart.appendChild(text);
  }

  const hoveredIndex = activeHoverIndex ?? lastIndex;
  const hoveredPoint = simulation.points[hoveredIndex];
  chart.appendChild(
    createSvgElement("line", {
      x1: String(xPositions[hoveredIndex]),
      y1: String(padding.top),
      x2: String(xPositions[hoveredIndex]),
      y2: String(height - padding.bottom),
      class: "hover-line",
    }),
  );
  chart.appendChild(
    createSvgElement("circle", {
      cx: String(xPositions[hoveredIndex]),
      cy: String(yForValue(hoveredPoint.indexValue)),
      r: "6",
      class: "hover-point",
    }),
  );
}

function renderMetrics(simulation: SimulationState): void {
  const latestPoint = simulation.points.at(-1);
  const hoverPoint = activeHoverIndex !== null ? simulation.points[activeHoverIndex] : latestPoint;

  const hint = simulation.warning ?? `起投生效日：${simulation.startDate}`;
  formHint.textContent = hint;
  formHint.classList.toggle("warning-text", Boolean(simulation.warning));

  if (!latestPoint) {
    summaryGrid.innerHTML = `<p class="empty-state">无可计算数据</p>`;
    hoverGrid.innerHTML = `<p class="empty-state">请选择更早的开始日期</p>`;
    return;
  }

  summaryGrid.innerHTML = buildMetricGrid([
    metricItem("累计投入", formatCurrency(latestPoint.investedAmount), "neutral"),
    metricItem("持仓市值", formatCurrency(latestPoint.portfolioValue), "neutral"),
    metricItem("总收益", formatCurrency(latestPoint.profit), valueTone(latestPoint.profit)),
    metricItem("收益率", formatPercent(latestPoint.profitRate), valueTone(latestPoint.profitRate)),
  ]);

  if (!hoverPoint) {
    hoverGrid.innerHTML = `<p class="empty-state">暂无 hover 数据</p>`;
    return;
  }

  hoverGrid.innerHTML = buildMetricGrid([
    metricItem("当前日期", hoverPoint.date, "neutral"),
    metricItem("纳指点位", formatIndexValue(hoverPoint.indexValue), "neutral"),
    metricItem("累计投入", formatCurrency(hoverPoint.investedAmount), "neutral"),
    metricItem("持仓市值", formatCurrency(hoverPoint.portfolioValue), "neutral"),
    metricItem("总收益", formatCurrency(hoverPoint.profit), valueTone(hoverPoint.profit)),
    metricItem("收益率", formatPercent(hoverPoint.profitRate), valueTone(hoverPoint.profitRate)),
  ]);
}

function handleChartPointerMove(event: PointerEvent): void {
  if (!currentSimulation || currentSimulation.points.length === 0 || !currentChartLayout) {
    return;
  }

  const rect = chart.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * currentChartLayout.width;
  const nextIndex = findNearestIndex(currentChartLayout.xPositions, x);

  if (nextIndex !== activeHoverIndex) {
    activeHoverIndex = nextIndex;
    renderChart(currentSimulation);
    renderMetrics(currentSimulation);
  }
}

function handleChartPointerLeave(): void {
  if (!currentSimulation || currentSimulation.points.length === 0) {
    return;
  }

  const latestIndex = currentSimulation.points.length - 1;
  if (activeHoverIndex !== latestIndex) {
    activeHoverIndex = latestIndex;
    renderChart(currentSimulation);
    renderMetrics(currentSimulation);
  }
}

function metricItem(label: string, value: string, tone: "positive" | "negative" | "neutral"): string {
  return `
    <article class="metric">
      <p class="metric-label">${label}</p>
      <p class="metric-value ${tone}">${value}</p>
    </article>
  `;
}

function buildMetricGrid(items: string[]): string {
  return items.join("");
}

function valueTone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "neutral";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatIndexValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMidDate(startDate: string, endDate: string): string {
  const midpoint = Math.round((toUtcTimestamp(startDate) + toUtcTimestamp(endDate)) / 2);
  return new Date(midpoint).toISOString().slice(0, 10);
}

function toUtcTimestamp(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function findNearestIndex(values: number[], target: number): number {
  if (values.length <= 1) {
    return 0;
  }

  if (target <= values[0]) {
    return 0;
  }

  const lastIndex = values.length - 1;
  if (target >= values[lastIndex]) {
    return lastIndex;
  }

  let left = 0;
  let right = lastIndex;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (values[middle] < target) {
      left = middle + 1;
    } else {
      right = middle;
    }
  }

  const current = values[left];
  const previous = values[left - 1];
  return Math.abs(current - target) < Math.abs(previous - target) ? left : left - 1;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}
