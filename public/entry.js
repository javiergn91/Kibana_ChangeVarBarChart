import {VisFactoryProvider} from 'ui/vis/vis_factory';
import {VisTypesRegistryProvider} from 'ui/registry/vis_types';
import {Schemas} from 'ui/vis/editors/default/schemas';
import './style.css';

/**
 * Este plugin muestra el estado de una variable en funcion del tiempo en base a un color
 * El primer Bucket Split debe ser un timestamp, el segundo Bucket split debe ser
 * la variable a mostrar (el color en el grafico) y el resto de los Bucket Split crearan
 * multiples graficos listados de forma vertical.
 */

class ChartVis {
    constructor(el, vis) {
        this.el = el;
        this.vis = vis;

        //Todos los datasets se guardan en este arreglo, necesario
        //para el feature de tooltip
        this.datasetByIndex = new Array();   

        this.container = document.createElement("div");
        this.container.id = "chart";
        this.el.appendChild(this.container);
    }

    //Si date es menor a 10, le agrega un 0 a la izquierda. Ejemplo: addZeroToDate(4) retorna 04
    addZeroToDate(date) {
        if(date < 10) {
            return "0" + date;
        }
        
        return date;
    }

    async render(visData, status) {
        console.log(visData);

        //Indice de la columna de tiempo
        var timestampCol = "";

        //Indice de la columna de la variable
        var statusCol = "";
        
        //Resto de parametros que dividen el grafico en muchos graficos
        var splitParams = new Array();

        //Distintos datasets, dependiendo del contenido de splitParams
        var datasets = new Array();

        //Buscar indices de las columnas
        visData.columns.forEach(function(column) {
            if(typeof column.aggConfig.__schema != "undefined")
            {                
                //Se asume que la primera columna que se encuentre
                //es la de tiempo, la segunda la de la variable y el resto
                //de los splits
                if(timestampCol == "")
                    timestampCol = column.id;
                else if(statusCol == "")
                    statusCol = column.id;
                else
                    splitParams.push(column.id);
            }
        });
        console.log(timestampCol);
        console.log(statusCol);
        console.log(splitParams);
        //Si splitParams es mayor a 0, entonces se formaran llaves 
        //que seran los indices del arreglo datasets, indicando las divisiones.
        var keys = new Array();

        //Referencia a esta misma clase, para ser usada dentro de callbacks.
        var self = this;

        self.datasetByIndex = new Array();  

        //Iterar por los valores
        visData.rows.forEach(function(row) {
            var timestamp = row[timestampCol];
            var status = row[statusCol];
            var key = "";

            //Construir key
            for(var i = 0; i < splitParams.length; i++) {
                if(i > 0)
                    key += " - ";

                var partialKey = row[splitParams[i]];
                key += partialKey;
            }

            //Inicializar entrada en datasets si no se encuentra la key
            if(typeof datasets[key] == "undefined") {
                datasets[key] = new Array();
                keys.push(key);
            }

            //Los datos se conforman de timestamp, status y end. La variable
            //end indica el fin de un datasets. Se usa de este modo porque en el arreglo
            //datasetsByIndex estan todos los datos juntos y no hay forma de saber cuando
            //termina un dataset y comienza otro.
            datasets[key].push({
                "timestamp": timestamp,
                "status": status,
                "end": false
            });
        });

        //Dibujado de los graficos
        //Limpiar contenido previo
        this.container.innerHTML = "";      

        for(var i = 0; i < keys.length; i++) {
            datasets[keys[i]].reverse();

            for(var j = 0; j < datasets[keys[i]].length; j++) {
                if(j + 1 >= datasets[keys[i]].length)
                {
                    //Indica fin de este dataset
                    datasets[keys[i]][j].end = true;
                }

                self.datasetByIndex.push(datasets[keys[i]][j]);
            }

            this.createChart(i, keys[i], datasets[keys[i]]);
        }

        this.addListeners();
    }

    //Añade la funcionalidad de tooltip, al pasar el mouse por encima de una barra
    //muestra informacion de dicho estado
    addListeners() {
        var self = this;
        var tooltip = d3.select("#chart").append("div").attr("class", "tooltip").style("opacity", 0);

        d3.selectAll("rect").on("mouseover", function(_d, i) {
            var d = self.datasetByIndex[i];

            tooltip.transition()		
            .duration(200)		
            .style("opacity", 1);
            
            var svg = d3.select("#barChart0");
            var rootPosition = svg.node().getBoundingClientRect();
            var message = "";

            var date = new Date(d.timestamp);
            var start = self.addZeroToDate(date.getDate()) + "/";
            start += self.addZeroToDate(date.getMonth()) + "/";
            start += date.getFullYear() + " ";
            start += self.addZeroToDate(date.getHours()) + ":";
            start += self.addZeroToDate(date.getMinutes());

            var duration = 0;

            if(i+1 < self.datasetByIndex.length && !self.datasetByIndex[i].end) {
                duration = parseInt((self.datasetByIndex[i + 1].timestamp - d.timestamp) / 60000);
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
                .style("top", (d3.event.pageY + 30 - rootPosition.y) + "px");	
        });

        d3.selectAll("rect").on("mouseout", function(d) {		
            tooltip.transition()		
                .duration(500)		
                .style("opacity", 0);	
        });
    }

    createChart(index, key, dataset)
    {
        var baseContent = "<div class = 'chartContainer'>";
        baseContent += "<div class = 'chartName'>" + key + "</div>";
        baseContent += "<div class = 'barChartContainer'><svg id = 'barChart" + index + "'></svg></div>";
        baseContent += "</div>";

        this.container.innerHTML += baseContent;

        var self = this;
        var firstTimestamp = 0;
        var lastTimestamp = Math.round((new Date()).getTime());

        firstTimestamp = dataset[0].timestamp;

        var svgWidth = 500;
        var svgHeight = 30;
        var widthTimestamp = lastTimestamp - firstTimestamp;
        var svg = d3.select("#barChart" + index)
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .attr("class", "bar-chart");

        var barChart = svg.selectAll("rect")
            .data(dataset)
            .enter()
            .append("rect")
            .attr("y", function(d) {
                return svgHeight - 30;
            })
            .attr("height", function(d) {
                return 30;
            })
            .attr("width", function(d, i) {
                var diff = 0;

                if(i + 1 < dataset.length) {
                    diff = dataset[i + 1].timestamp - dataset[i].timestamp;
                } else {
                    diff = lastTimestamp - dataset[i].timestamp;
                }

                var resultWidth = (svgWidth * diff) / widthTimestamp;

                return resultWidth;
            })
            .attr("transform", function(d, i) {
                var diff = d.timestamp - firstTimestamp;
                var value = diff / widthTimestamp;
                var xCoordinate = value * svgWidth;
                return "translate(" + xCoordinate + ")";
            })
            .attr("fill", function(d) {
                if(d.status == "WARNING") {
                    return "#d8ff3a";
                } else if(d.status == "CRITICAL") {
                    return "#f12323";
                } else {
                    return "#3db900";
                }
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