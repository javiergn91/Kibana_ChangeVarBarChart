import {VisFactoryProvider} from 'ui/vis/vis_factory';
import {VisTypesRegistryProvider} from 'ui/registry/vis_types';
import {Schemas} from 'ui/vis/editors/default/schemas';
import './style.css';

class ChartVis {
    constructor(el, vis) {
        this.el = el;
        this.vis = vis;
        this.container = document.createElement("div");
        this.container.id = "chart";
        this.container.innerHTML = "<svg id = 'barChart'></svg>";
        this.el.appendChild(this.container);
    }

    addZeroToDate(date) {
        if(date < 10) {
            return "0" + date;
        }
        
        return date;
    }

    async render(visData, status) {
        var self = this;
        var timestampCol = "";
        var statusCol = "";

        visData.columns.forEach(function(column) {
            if(typeof column.aggConfig.__schema != "undefined")
            {
                let colName = column.aggConfig.__schema.name;
                
                if(timestampCol == "")
                    timestampCol = column.id;
                else
                    statusCol = column.id;
            }
        });

        var dataset = [];

        var firstTimestamp = 0;
        var lastTimestamp = Math.round((new Date()).getTime());

        visData.rows.forEach(function(row) {
            var timestamp = row[timestampCol];
            var status = row[statusCol];

            dataset.push({
                "timestamp": timestamp,
                "status": status
            });
        });

        dataset.reverse();

        firstTimestamp = dataset[0].timestamp;

        var svgWidth = 500;
        var svgHeight = 300;
        var widthTimestamp = lastTimestamp - firstTimestamp;
console.log("widthTimestamp; " + widthTimestamp);
        var svg = d3.select("#barChart")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .attr("class", "bar-chart");

        var tooltip = d3.select("#chart").append("div").attr("class", "tooltip").style("opacity", 0);
        
        var barPadding = 5;
        var barWidth = svgWidth / dataset.length;

        var barChart = svg.selectAll("rect")
            .data(dataset)
            .enter()
            .append("rect")
            .attr("y", function(d) {
                return svgHeight - 250;
            })
            .attr("height", function(d) {
                return 250;
            })
            .attr("width", function(d, i) {
                var diff = 0;

                if(i + 1 < dataset.length) {
                    diff = dataset[i + 1].timestamp - dataset[i].timestamp;
                } else {
                    diff = lastTimestamp - dataset[i].timestamp;
                    console.log(lastTimestamp + ", " + dataset[i].timestamp);
                }

                //console.log(i + ", " + diff);

                var resultWidth = (svgWidth * diff) / widthTimestamp;

                return resultWidth;
            })
            .attr("transform", function(d, i) {
                var diff = d.timestamp - firstTimestamp;
                console.log(d.timestamp + ", " + firstTimestamp);
                var value = diff / widthTimestamp;
                var xCoordinate = value * svgWidth;
                return "translate(" + xCoordinate + ")";

                //var xCoordinate = barWidth * i;
                //return "translate(" + xCoordinate + ")";
            })
            .attr("fill", function(d) {
                if(d.status == "WARNING") {
                    return "#d8ff3a";
                } else if(d.status == "CRITICAL") {
                    return "#f12323";
                } else {
                    return "#3db900";
                }
            })
            .on("mouseover", function(d, i) {
                tooltip.transition()		
                .duration(200)		
                .style("opacity", 1);
                
                var rootPosition = svg.node().getBoundingClientRect();
                var message = "";

                var date = new Date(d.timestamp);
                var start = self.addZeroToDate(date.getDate()) + "/";
                start += self.addZeroToDate(date.getMonth()) + "/";
                start += date.getFullYear() + " ";
                start += self.addZeroToDate(date.getHours()) + ":";
                start += self.addZeroToDate(date.getMinutes());

                var duration = 0;

                if(i+1 < dataset.length) {
                    duration = parseInt((dataset[i + 1].timestamp - d.timestamp) / 60000);
                    duration += " min(s)";
                } else {
                    var ts = Math.round((new Date()).getTime() / 1000);
                    duration = parseInt((ts - d.timestamp / 1000) / 60) + " min(s)";
                }

                message += "Estado: " + d.status + "<br>";
                message += "Inicio: " + start + "<br>";
                message += "Duracion: " + duration;

                tooltip.html(message)	
                    .style("left", (d3.event.pageX - rootPosition.x) + "px")		
                    .style("top", (d3.event.pageY - 28 - rootPosition.y) + "px");	
            })
            .on("mouseout", function(d) {		
                tooltip.transition()		
                    .duration(500)		
                    .style("opacity", 0);	
            });
    }

    destroy() {
        this.el.innerHTML = "";
    }
}

const statusChartVis = (Private) => {
    const visFactory = Private(VisFactoryProvider);

    return visFactory.createBaseVisualization({
        name: "status_chart",
        title: "Status Chart",
        icon: "asterisk",
        description: "Status Chart",
        visualization: ChartVis,
        editorConfig: {
            schemas: new Schemas([
                {
                    group: 'metrics',
                    name: 'trafficlight',
                    title: 'metrics title',
                    min: 1,
                    aggFilter: ["count"],
                    defaults: [{
                        type: 'count',
                        schema: 'metric'
                    }]
                },
                {
                    group: "buckets",
                    name: "segment",
                    title: "Bucket Split",
                    aggFilter: ["terms"]
                }])
        }    
    });
}

VisTypesRegistryProvider.register(statusChartVis);