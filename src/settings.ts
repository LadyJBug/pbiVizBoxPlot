/*
 *  Power BI Box Plot Visual
 *
 *  Copyright (c) LadyJBug
 *  MIT License
 */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Box Plot appearance settings card
 */
class BoxPlotCardSettings extends FormattingSettingsCard {
    boxColor = new formattingSettings.ColorPicker({
        name: "boxColor",
        displayName: "Box Color",
        value: { value: "#4472C4" }
    });

    boxOpacity = new formattingSettings.NumUpDown({
        name: "boxOpacity",
        displayName: "Box Opacity (%)",
        value: 70,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 100 }
        }
    });

    medianColor = new formattingSettings.ColorPicker({
        name: "medianColor",
        displayName: "Median Line Color",
        value: { value: "#FF0000" }
    });

    whiskerColor = new formattingSettings.ColorPicker({
        name: "whiskerColor",
        displayName: "Whisker Color",
        value: { value: "#2E2E2E" }
    });

    outlierColor = new formattingSettings.ColorPicker({
        name: "outlierColor",
        displayName: "Outlier Color",
        value: { value: "#FF6B35" }
    });

    outlierRadius = new formattingSettings.NumUpDown({
        name: "outlierRadius",
        displayName: "Outlier Dot Size",
        value: 4,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 }
        }
    });

    showSampleSize = new formattingSettings.ToggleSwitch({
        name: "showSampleSize",
        displayName: "Show Sample Size Label",
        value: true
    });

    name: string = "boxPlot";
    displayName: string = "Box Plot";
    slices: Array<FormattingSettingsSlice> = [
        this.boxColor,
        this.boxOpacity,
        this.medianColor,
        this.whiskerColor,
        this.outlierColor,
        this.outlierRadius,
        this.showSampleSize
    ];
}

/**
 * X-Axis settings card
 */
class XAxisCardSettings extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show X-Axis",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        value: 11,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 6 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 40 }
        }
    });

    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font Color",
        value: { value: "#333333" }
    });

    name: string = "xAxis";
    displayName: string = "X-Axis";
    slices: Array<FormattingSettingsSlice> = [this.show, this.fontSize, this.fontColor];
}

/**
 * Y-Axis settings card
 */
class YAxisCardSettings extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show Y-Axis",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        value: 11,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 6 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 40 }
        }
    });

    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font Color",
        value: { value: "#333333" }
    });

    gridLines = new formattingSettings.ToggleSwitch({
        name: "gridLines",
        displayName: "Show Grid Lines",
        value: true
    });

    name: string = "yAxis";
    displayName: string = "Y-Axis";
    slices: Array<FormattingSettingsSlice> = [this.show, this.fontSize, this.fontColor, this.gridLines];
}

/**
 * Visual formatting settings model
 */
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    boxPlotCard = new BoxPlotCardSettings();
    xAxisCard = new XAxisCardSettings();
    yAxisCard = new YAxisCardSettings();

    cards = [this.boxPlotCard, this.xAxisCard, this.yAxisCard];
}
