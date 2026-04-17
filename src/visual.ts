/*
 *  Power BI Box Plot Visual
 *
 *  Copyright (c) LadyJBug
 *  MIT License
 *
 *  A sleek Box Plot custom visual for Power BI.
 *  Data roles:
 *    - Category  : Grouping field for the X-axis (optional)
 *    - Quartiles : Three measures in order → Q1, Median (Q2), Q3
 *    - Whiskers  : Two measures in order  → Lower whisker (Min), Upper whisker (Max)
 *    - Outliers  : One or more measures for individual outlier values
 *    - Sample Size: One measure for the sample count (N)
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import DataViewCategorical = powerbi.DataViewCategorical;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import { VisualFormattingSettingsModel } from "./settings";

// ─── Data model ─────────────────────────────────────────────────────────────

interface BoxPlotDataPoint {
    category: string;
    q1: number;
    median: number;
    q3: number;
    whiskerLow: number;
    whiskerHigh: number;
    outliers: number[];
    sampleSize: number | null;
    selectionId: powerbi.visuals.ISelectionId;
}

// ─── Main Visual class ───────────────────────────────────────────────────────

export class Visual implements IVisual {
    private host: IVisualHost;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private plotArea: d3.Selection<SVGGElement, unknown, null, undefined>;
    private xAxisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private yAxisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
    private selectionManager: ISelectionManager;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();
        this.selectionManager = options.host.createSelectionManager();

        // Root SVG
        this.svg = d3.select(options.element)
            .append("svg")
            .classed("boxPlotSvg", true);

        // Layer order: grid → plot → axes
        this.gridGroup = this.svg.append("g").classed("grid", true);
        this.plotArea = this.svg.append("g").classed("plotArea", true);
        this.xAxisGroup = this.svg.append("g").classed("xAxis", true);
        this.yAxisGroup = this.svg.append("g").classed("yAxis", true);

        // Floating tooltip div
        this.tooltip = d3.select(options.element)
            .append("div")
            .classed("boxPlotTooltip", true)
            .style("opacity", 0);
    }

    // ─── Update ─────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions) {
        const dataView: DataView = options.dataViews?.[0];
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel, dataView
        );

        const width = options.viewport.width;
        const height = options.viewport.height;

        this.svg
            .attr("width", width)
            .attr("height", height);

        // Clear previous render
        this.plotArea.selectAll("*").remove();
        this.xAxisGroup.selectAll("*").remove();
        this.yAxisGroup.selectAll("*").remove();
        this.gridGroup.selectAll("*").remove();

        if (!dataView?.categorical?.values?.length) {
            this.renderEmptyState(width, height);
            return;
        }

        const data = this.parseData(dataView);
        if (!data.length) {
            this.renderEmptyState(width, height);
            return;
        }

        this.renderBoxPlot(data, width, height);
    }

    // ─── Parse data ─────────────────────────────────────────────────────────

    private parseData(dataView: DataView): BoxPlotDataPoint[] {
        const categorical: DataViewCategorical = dataView.categorical;
        const categories = categorical.categories?.[0];
        const values = categorical.values;

        // Separate measures by role
        const quartileCols = values.filter(v => v.source.roles?.["quartiles"]);
        const whiskerCols  = values.filter(v => v.source.roles?.["whiskers"]);
        const outlierCols  = values.filter(v => v.source.roles?.["outliers"]);
        const sampleCols   = values.filter(v => v.source.roles?.["sampleSize"]);

        // Determine number of data points from the first available column
        const rowCount = quartileCols[0]?.values?.length
            ?? whiskerCols[0]?.values?.length
            ?? 1;

        const dataPoints: BoxPlotDataPoint[] = [];

        for (let i = 0; i < rowCount; i++) {
            const q1     = this.numOrNull(quartileCols[0]?.values?.[i]);
            const median = this.numOrNull(quartileCols[1]?.values?.[i]);
            const q3     = this.numOrNull(quartileCols[2]?.values?.[i]);
            const low    = this.numOrNull(whiskerCols[0]?.values?.[i]);
            const high   = this.numOrNull(whiskerCols[1]?.values?.[i]);

            // Need at least Q1/Q3 or whiskers to draw anything meaningful
            if (q1 === null && q3 === null && low === null && high === null) continue;

            const outliers: number[] = outlierCols
                .map(col => this.numOrNull(col.values?.[i]))
                .filter((v): v is number => v !== null);

            const sampleSize = sampleCols[0]
                ? this.numOrNull(sampleCols[0].values?.[i])
                : null;

            const catLabel = categories
                ? String(categories.values[i] ?? `Group ${i + 1}`)
                : "All";

            const selectionId = this.host
                .createSelectionIdBuilder()
                .withCategory(categories, i)
                .createSelectionId();

            dataPoints.push({
                category: catLabel,
                q1: q1 ?? low ?? 0,
                median: median ?? ((q1 ?? 0) + (q3 ?? 0)) / 2,
                q3: q3 ?? high ?? 0,
                whiskerLow: low ?? q1 ?? 0,
                whiskerHigh: high ?? q3 ?? 0,
                outliers,
                sampleSize,
                selectionId
            });
        }

        return dataPoints;
    }

    // ─── Render box plot ─────────────────────────────────────────────────────

    private renderBoxPlot(data: BoxPlotDataPoint[], width: number, height: number) {
        const settings = this.formattingSettings;
        const bp = settings.boxPlotCard;
        const xa = settings.xAxisCard;
        const ya = settings.yAxisCard;

        const margin = {
            top: 20,
            right: 20,
            bottom: xa.show.value ? 50 : 10,
            left: ya.show.value ? 55 : 10
        };

        const innerW = Math.max(width  - margin.left - margin.right,  10);
        const innerH = Math.max(height - margin.top  - margin.bottom, 10);

        // ── Y scale (value axis) ──────────────────────────────────────────
        const allValues: number[] = data.flatMap(d => [
            d.q1, d.median, d.q3,
            d.whiskerLow, d.whiskerHigh,
            ...d.outliers
        ]);

        const yMin = (d3.min(allValues) ?? 0) * 0.95;
        const yMax = (d3.max(allValues) ?? 1) * 1.05;

        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([innerH, 0])
            .nice();

        // ── X scale (category axis) ───────────────────────────────────────
        const xScale = d3.scaleBand()
            .domain(data.map(d => d.category))
            .range([0, innerW])
            .padding(0.3);

        // ── Position main group ───────────────────────────────────────────
        this.plotArea.attr("transform", `translate(${margin.left},${margin.top})`);
        this.xAxisGroup.attr("transform", `translate(${margin.left},${margin.top + innerH})`);
        this.yAxisGroup.attr("transform", `translate(${margin.left},${margin.top})`);
        this.gridGroup.attr("transform", `translate(${margin.left},${margin.top})`);

        // ── Grid lines ────────────────────────────────────────────────────
        if (ya.gridLines.value) {
            this.gridGroup
                .call(
                    d3.axisLeft(yScale)
                        .tickSize(-innerW)
                        .tickFormat(() => "")
                )
                .call(g => g.select(".domain").remove())
                .call(g => g.selectAll(".tick line")
                    .attr("stroke", "#e0e0e0")
                    .attr("stroke-dasharray", "3,3")
                );
        }

        // ── X Axis ────────────────────────────────────────────────────────
        if (xa.show.value) {
            this.xAxisGroup
                .call(d3.axisBottom(xScale))
                .call(g => g.select(".domain").attr("stroke", "#aaa"))
                .call(g => g.selectAll("text")
                    .style("font-size", `${xa.fontSize.value}px`)
                    .style("fill", xa.fontColor.value.value)
                    .style("font-family", "Segoe UI, sans-serif")
                );
        }

        // ── Y Axis ────────────────────────────────────────────────────────
        if (ya.show.value) {
            this.yAxisGroup
                .call(d3.axisLeft(yScale).ticks(6))
                .call(g => g.select(".domain").attr("stroke", "#aaa"))
                .call(g => g.selectAll("text")
                    .style("font-size", `${ya.fontSize.value}px`)
                    .style("fill", ya.fontColor.value.value)
                    .style("font-family", "Segoe UI, sans-serif")
                );
        }

        // ── Box plots ─────────────────────────────────────────────────────
        const boxColor     = bp.boxColor.value.value     || "#4472C4";
        const medianColor  = bp.medianColor.value.value  || "#FF0000";
        const whiskerColor = bp.whiskerColor.value.value || "#2E2E2E";
        const outlierColor = bp.outlierColor.value.value || "#FF6B35";
        const boxOpacity   = (bp.boxOpacity.value ?? 70) / 100;
        const outlierR     = bp.outlierRadius.value ?? 4;

        const tooltip = this.tooltip;

        data.forEach(d => {
            const bw   = xScale.bandwidth();
            const cx   = (xScale(d.category) ?? 0) + bw / 2;
            const capW = bw * 0.4;

            const g = this.plotArea.append("g").classed("boxGroup", true);

            // ── Whisker vertical line ─────────────────────────────────
            g.append("line")
                .classed("whiskerLine", true)
                .attr("x1", cx).attr("x2", cx)
                .attr("y1", yScale(d.whiskerHigh))
                .attr("y2", yScale(d.whiskerLow))
                .attr("stroke", whiskerColor)
                .attr("stroke-width", 1.5);

            // ── Upper whisker cap ─────────────────────────────────────
            g.append("line")
                .classed("whiskerCap", true)
                .attr("x1", cx - capW / 2).attr("x2", cx + capW / 2)
                .attr("y1", yScale(d.whiskerHigh))
                .attr("y2", yScale(d.whiskerHigh))
                .attr("stroke", whiskerColor)
                .attr("stroke-width", 1.5);

            // ── Lower whisker cap ─────────────────────────────────────
            g.append("line")
                .classed("whiskerCap", true)
                .attr("x1", cx - capW / 2).attr("x2", cx + capW / 2)
                .attr("y1", yScale(d.whiskerLow))
                .attr("y2", yScale(d.whiskerLow))
                .attr("stroke", whiskerColor)
                .attr("stroke-width", 1.5);

            // ── IQR box (Q1 → Q3) ─────────────────────────────────────
            const boxTop    = yScale(d.q3);
            const boxBottom = yScale(d.q1);
            const boxH      = Math.abs(boxBottom - boxTop);

            g.append("rect")
                .classed("iqrBox", true)
                .attr("x", xScale(d.category) ?? 0)
                .attr("y", boxTop)
                .attr("width", bw)
                .attr("height", Math.max(boxH, 1))
                .attr("fill", boxColor)
                .attr("fill-opacity", boxOpacity)
                .attr("stroke", boxColor)
                .attr("stroke-width", 1.5)
                .attr("rx", 2)
                .on("mouseover", (event: MouseEvent) => this.showTooltip(event, d, tooltip))
                .on("mousemove", (event: MouseEvent) => this.moveTooltip(event, tooltip))
                .on("mouseout",  ()                  => this.hideTooltip(tooltip));

            // ── Median line ───────────────────────────────────────────
            g.append("line")
                .classed("medianLine", true)
                .attr("x1", xScale(d.category) ?? 0)
                .attr("x2", (xScale(d.category) ?? 0) + bw)
                .attr("y1", yScale(d.median))
                .attr("y2", yScale(d.median))
                .attr("stroke", medianColor)
                .attr("stroke-width", 2.5);

            // ── Outlier dots ──────────────────────────────────────────
            d.outliers.forEach(ov => {
                g.append("circle")
                    .classed("outlierDot", true)
                    .attr("cx", cx)
                    .attr("cy", yScale(ov))
                    .attr("r", outlierR)
                    .attr("fill", outlierColor)
                    .attr("fill-opacity", 0.8)
                    .attr("stroke", outlierColor)
                    .attr("stroke-width", 1)
                    .on("mouseover", (event: MouseEvent) => this.showTooltip(event, d, tooltip, ov))
                    .on("mousemove", (event: MouseEvent) => this.moveTooltip(event, tooltip))
                    .on("mouseout",  ()                  => this.hideTooltip(tooltip));
            });

            // ── Sample size label ─────────────────────────────────────
            if (bp.showSampleSize.value && d.sampleSize !== null) {
                g.append("text")
                    .classed("sampleLabel", true)
                    .attr("x", cx)
                    .attr("y", yScale(d.whiskerHigh) - 6)
                    .attr("text-anchor", "middle")
                    .style("font-size", "10px")
                    .style("fill", "#555")
                    .style("font-family", "Segoe UI, sans-serif")
                    .text(`n=${this.formatNumber(d.sampleSize)}`);
            }
        });
    }

    // ─── Tooltip helpers ─────────────────────────────────────────────────────

    private showTooltip(
        event: MouseEvent,
        d: BoxPlotDataPoint,
        tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
        outlierValue?: number
    ) {
        const node = tooltip.node();
        if (!node) return;

        // Clear previous content using safe DOM methods
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }

        // Title row
        const title = document.createElement("strong");
        title.textContent = d.category;
        node.appendChild(title);

        const addRow = (label: string, value: string) => {
            const row = document.createElement("div");
            const lbl = document.createElement("span");
            lbl.className = "label";
            lbl.textContent = `${label}: `;
            const val = document.createTextNode(value);
            row.appendChild(lbl);
            row.appendChild(val);
            node.appendChild(row);
        };

        if (outlierValue !== undefined) {
            addRow("Outlier", this.formatNumber(outlierValue));
        } else {
            addRow("Max (Whisker)", this.formatNumber(d.whiskerHigh));
            addRow("Q3",           this.formatNumber(d.q3));
            addRow("Median",       this.formatNumber(d.median));
            addRow("Q1",           this.formatNumber(d.q1));
            addRow("Min (Whisker)", this.formatNumber(d.whiskerLow));
        }
        if (d.sampleSize !== null) {
            addRow("Sample Size (n)", this.formatNumber(d.sampleSize));
        }

        tooltip
            .style("opacity", 1)
            .style("left",  `${event.offsetX + 12}px`)
            .style("top",   `${event.offsetY - 28}px`);
    }

    private moveTooltip(event: MouseEvent, tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
        tooltip
            .style("left", `${event.offsetX + 12}px`)
            .style("top",  `${event.offsetY - 28}px`);
    }

    private hideTooltip(tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
        tooltip.style("opacity", 0);
    }

    // ─── Empty state ─────────────────────────────────────────────────────────

    private renderEmptyState(width: number, height: number) {
        this.plotArea
            .append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-size", "14px")
            .style("fill", "#999")
            .style("font-family", "Segoe UI, sans-serif")
            .text("Add Quartiles and Whiskers data to display the Box Plot");
    }

    // ─── Formatting model ────────────────────────────────────────────────────

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private numOrNull(value: powerbi.PrimitiveValue | undefined): number | null {
        if (value === null || value === undefined) return null;
        const n = Number(value);
        return isNaN(n) ? null : n;
    }

    private formatNumber(value: number): string {
        if (Math.abs(value) >= 1e6)  return d3.format(".3s")(value);
        if (Math.abs(value) >= 1000) return d3.format(",.0f")(value);
        return d3.format(".2f")(value);
    }
}
