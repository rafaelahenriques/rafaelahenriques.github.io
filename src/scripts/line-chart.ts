/**
 * Client behaviour for LineChart.astro: a crosshair that snaps to the
 * nearest year with a tooltip listing every series (pointer + arrow keys),
 * plus helpers the data story uses to focus series and annotate a year.
 */

interface ChartConfig {
    years: number[];
    unit: string;
    series: { key: string; label: string; color: string; values: (number | null)[] }[];
}

const initialised = new WeakSet<HTMLElement>();

const configOf = (chart: HTMLElement): ChartConfig => JSON.parse(chart.dataset.config ?? "{}");

const xPercent = (config: ChartConfig, index: number) => (index / (config.years.length - 1)) * 100;

/** Dim every series except `keys`; `null` shows all with no emphasis. */
export function setFocus(chart: HTMLElement, keys: string[] | null) {
    chart.querySelectorAll<HTMLElement | SVGElement>("[data-series]").forEach((el) => {
        const key = el.dataset.series ?? "";
        const focused = keys === null || keys.includes(key);
        el.classList.toggle("is-dim", !focused);
        if (el.classList.contains("end-label")) {
            el.classList.toggle("is-labelled", keys !== null && focused);
        }
    });
}

/** Draw a labelled vertical marker at `year`; `null` removes it. */
export function annotate(chart: HTMLElement, year: number | null, text = "") {
    const marker = chart.querySelector<HTMLElement>("[data-annotation]");
    const label = chart.querySelector<HTMLElement>("[data-annotation-text]");
    if (!marker || !label) return;
    const config = configOf(chart);
    const index = year === null ? -1 : config.years.indexOf(year);
    marker.hidden = index < 0;
    if (index < 0) return;
    const x = xPercent(config, index);
    marker.style.left = `${x}%`;
    marker.classList.toggle("is-flipped", x > 60);
    label.textContent = text;
}

function initChart(chart: HTMLElement) {
    if (initialised.has(chart)) return;
    initialised.add(chart);

    const config = configOf(chart);
    const plot = chart.querySelector<HTMLElement>(".line-chart__plot")!;
    const area = chart.querySelector<HTMLElement>("[data-area]")!;
    const crosshair = chart.querySelector<HTMLElement>("[data-crosshair]")!;
    const tooltip = chart.querySelector<HTMLElement>("[data-tooltip]")!;
    const live = chart.querySelector<HTMLElement>("[data-live]")!;
    const format = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)}${config.unit}`);
    let current = -1;

    function show(index: number) {
        current = Math.max(0, Math.min(config.years.length - 1, index));
        const x = xPercent(config, current);
        crosshair.hidden = false;
        crosshair.style.left = `${x}%`;

        // Values lead, labels follow; sorted high → low. Built with
        // textContent because labels come from data.
        const rows = config.series
            .map((s) => ({ s, v: s.values[current] }))
            .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
        tooltip.replaceChildren();
        const head = document.createElement("p");
        head.className = "mono muted";
        head.style.margin = "0 0 6px";
        head.textContent = String(config.years[current]);
        tooltip.append(head);
        for (const { s, v } of rows) {
            const row = document.createElement("p");
            row.style.cssText = "display:flex;align-items:center;gap:8px;margin:2px 0";
            const key = document.createElement("span");
            key.className = "line-key";
            key.style.setProperty("--c", s.color);
            const value = document.createElement("strong");
            value.style.cssText = "font-weight:800;min-width:3.6em;font-variant-numeric:tabular-nums";
            value.textContent = format(v);
            const label = document.createElement("span");
            label.className = "muted";
            label.textContent = s.label;
            row.append(key, value, label);
            tooltip.append(row);
        }

        tooltip.hidden = false;
        // keep the tooltip inside the plot: flip to the left past the middle
        const flip = x > 55;
        tooltip.style.left = flip ? "auto" : `calc(${x}% + 14px)`;
        tooltip.style.right = flip ? `calc(${100 - x}% + 14px)` : "auto";

        live.textContent = `${config.years[current]}: ${rows
            .map(({ s, v }) => `${s.label} ${format(v)}`)
            .join(", ")}`;
    }

    function hide() {
        crosshair.hidden = true;
        tooltip.hidden = true;
    }

    area.addEventListener("pointermove", (e) => {
        const rect = area.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width;
        show(Math.round(fx * (config.years.length - 1)));
    });
    area.addEventListener("pointerleave", hide);

    plot.addEventListener("keydown", (e) => {
        const last = config.years.length - 1;
        const moves: Record<string, number> = {
            ArrowLeft: current < 0 ? last : current - 1,
            ArrowRight: current < 0 ? last : current + 1,
            Home: 0,
            End: last,
        };
        if (!(e.key in moves)) return;
        e.preventDefault();
        show(moves[e.key]);
    });
    plot.addEventListener("blur", hide);
}

export function initLineCharts() {
    document.querySelectorAll<HTMLElement>("[data-line-chart]").forEach(initChart);
}
