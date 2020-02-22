import React, { useEffect, useRef, useState } from "react"
import {
  Button,
  Card,
  CardContent,
  Typography,
  ButtonGroup,
  Grid,
  Slider,
  Input,
  LinearProgress
} from "@material-ui/core"
import FitnessCenterIcon from "@material-ui/icons/FitnessCenter"
import LocalDrinkIcon from "@material-ui/icons/LocalDrink"
import HomeWorkIcon from "@material-ui/icons/HomeWork"
import BlurCircularIcon from "@material-ui/icons/BlurCircular"
import MultilineChartIcon from "@material-ui/icons/MultilineChart"
import ChangeHistoryIcon from "@material-ui/icons/ChangeHistory"
import {
  makeStyles,
  withStyles,
  createMuiTheme,
  ThemeProvider
} from "@material-ui/core/styles"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import shp from "shpjs"

import interpolate from "@turf/interpolate"
import worker from "workerize-loader!./work" // eslint-disable-line import/no-webpack-loader-syntax
var workerInstance = worker()

const styles = {
  width: "100vw",
  height: "calc(100vh - 64px)",
  position: "absolute"
}

const useStyles = makeStyles(uwTheme2 => ({
  card: {
    position: "absolute",
    "& > *": {
      margin: uwTheme2.spacing(1)
    },
    top: 76,
    right: 10,
    padding: 0,
    backgroundColor: "#ffffff95",
    color: uwTheme2.tertiary,
    transition: "0.3s",
    boxShadow: "0 8px 40px -12px rgba(0,0,0,0.3)",
    "&:hover": {
      boxShadow: "0 16px 70px -12.125px rgba(0,0,0,0.3)"
    }
  },
  typeHeaderBold: {
    fontWeight: 700
  },
  typeBold: {
    fontWeight: 700,
    paddingTop: uwTheme2.spacing(1.5),
    paddingBottom: uwTheme2.spacing(0.5)
  },
  layerButtons: {},
  kslider: {
    width: 180
  },
  input: {
    width: 40
  },
  loading: {
    width: "100%",
    position: "absolute",
    bottom: 0
  }
}))

const StyledButton = withStyles({
  root: {
    borderRadius: 3,
    boxShadow: "0 3px 5px 2px rgba(255, 105, 135, .3)"
  },
  label: {
    textTransform: "capitalize"
  }
})(Button)

const uwTheme2 = createMuiTheme({
  palette: {
    primary: {
      main: "#c5050c"
    },
    secondary: {
      main: "#dadfe1"
    }
  },
  status: {
    danger: "orange"
  }
})

const options = [
  {
    name: "Spatial Regression",
    description: "R^2 Value for each polygon",
    property: "pop_est",
    stops: [
      [0, "#f8d5cc"],
      [1000000, "#f4bfb6"],
      [5000000, "#f1a8a5"],
      [10000000, "#ee8f9a"],
      [50000000, "#ec739b"],
      [100000000, "#dd5ca8"],
      [250000000, "#c44cc0"],
      [500000000, "#9f43d7"],
      [1000000000, "#6e40e6"]
    ]
  }
]

const MapboxGLMap = () => {
  const classes = useStyles()
  const [map, setMap] = useState(null)
  const [lat, setLat] = useState(44.95)
  const [lng, setLng] = useState(-90)
  const [zoom, setZoom] = useState(6.5)
  const mapContainer = useRef(null)
  const [activeWN, setActiveWN] = useState(true)
  const [activeCT, setActiveCT] = useState(true)
  const [activeIDW, setActiveIDW] = useState(false)
  const [activeSR, setActiveSR] = useState(false)
  const [kValue, setKValue] = React.useState(2)
  const [sizeValue, setSizeValue] = React.useState(10)
  const [loading, setLoading] = React.useState(false)

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_KEY
    const initializeMap = ({ setMap, mapContainer }) => {
      var bounds = [
        [-95, 41], // Southwest coordinates
        [-85, 48] // Northeast coordinates
      ]

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v10", // stylesheet location
        center: [lng, lat],
        zoom: zoom,
        minZoom: 6.5,
        maxBounds: bounds
      })

      const navOptions = {
        visualizePitch: "true"
      }
      map.addControl(
        new mapboxgl.NavigationControl({ options: navOptions }),
        "top-left"
      )
      map.addControl(
        new mapboxgl.FullscreenControl({
          container: document.querySelector("body")
        }),
        "top-left"
      )

      map.on("load", () => {
        setMap(map)
        map.resize()

        var layers = map.getStyle().layers
        // Find the index of the first symbol layer in the map style
        var firstSymbolId
        for (var i = 0; i < layers.length; i++) {
          if (layers[i].type === "symbol") {
            firstSymbolId = layers[i].id
            break
          }
        }

        shp(process.env.PUBLIC_URL + "/shp/cancer_tracts.zip").then(
          function(geojsonCancerTracts) {
            map.addSource("cancer-tracts-data", {
              type: "geojson",
              data: geojsonCancerTracts
            })

            map.addLayer(
              {
                id: "cancer-tracts-data",
                type: "fill",
                source: "cancer-tracts-data",
                paint: {
                  "fill-color": "#f7f7f7",
                  "fill-opacity": 0.1
                },
                filter: ["==", "$type", "Polygon"]
              },
              "well-nitrate-data"
            )
          },
          function(err) {
            console.log("error:", err)
          }
        )

        shp(process.env.PUBLIC_URL + "/shp/well_nitrate.zip").then(
          function(geojsonWellNitrate) {
            map.addSource("well-nitrate-data", {
              type: "geojson",
              data: geojsonWellNitrate
            })

            map.addLayer(
              {
                id: "well-nitrate-data",
                type: "circle",
                source: "well-nitrate-data",
                paint: {
                  "circle-radius": 4,
                  "circle-color": "#B42222"
                },
                filter: ["==", "$type", "Point"]
              },
              firstSymbolId
            )

            // IDW Initialization based on k=2
            var options = {
              gridType: "triangle",
              property: "nitr_con",
              units: "miles",
              weight: kValue
            }

            // IDW Initialization based on k=value
            var options = {
              gridType: "triangle",
              property: "nitr_con",
              units: "kilometers",
              weight: kValue
            }

            var triangleGrid

            workerInstance.addEventListener("message", message => {
              if (message.data.type === "FeatureCollection") {
                triangleGrid = message.data

                if (map.getLayer("idw-data") !== undefined) {
                  map.removeLayer("idw-data")
                  map.removeSource("idw-data")
                }

                map.addSource("idw-data", {
                  type: "geojson",
                  data: triangleGrid
                })

                map.addLayer({
                  id: "idw-data",
                  type: "fill-extrusion",
                  source: "idw-data",
                  layout: {
                    visibility: "visible"
                  },
                  paint: {
                    "fill-extrusion-color": [
                      "interpolate",
                      ["linear"],
                      ["get", "nitr_con"],
                      0,
                      "#282728",
                      8,
                      "#B42222",
                      16,
                      "#fff"
                    ],
                    "fill-extrusion-height": [
                      "interpolate",
                      ["linear"],
                      ["get", "nitr_con"],
                      0,
                      -10000,
                      16,
                      250000
                    ],
                    "fill-extrusion-base": 0,
                    "fill-extrusion-opacity": 0.7
                  }
                })
                setActiveIDW(true)
              }
            })
            workerInstance.calcStuff(geojsonWellNitrate, sizeValue, options)
          },
          function(err) {
            console.log("error:", err)
          }
        )

        // IDW Layer Calc and Add

        // Create a popup, but don't add it to the map yet.
        var popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false
        })

        map.on("mouseenter", "well-nitrate-data", function(e) {
          // Change the cursor style as a UI indicator.
          map.getCanvas().style.cursor = "pointer"

          var coordinates = e.features[0].geometry.coordinates.slice()
          var nitrate_value = e.features[0].properties.nitr_con
          var body =
            "Nitrate Value: <strong>" + nitrate_value.toFixed(3) + "</strong>"

          // Ensure that if the map is zoomed out such that multiple
          // copies of the feature are visible, the popup appears
          // over the copy being pointed to.
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
          }

          // Populate the popup and set its coordinates
          // based on the feature found.
          popup
            .setLngLat(coordinates)
            .setHTML(body)
            .addTo(map)
        })

        map.on("mouseleave", "well-nitrate-data", function() {
          map.getCanvas().style.cursor = ""
          popup.remove()
        })
      })
    }

    if (!map) initializeMap({ setMap, mapContainer })
  }, [map])

  const calcIDW = (kValue, sizeValue) => {
    var geojsonWellNitrate = map.getSource("well-nitrate-data")._data

    // IDW Initialization based on k=value
    var options = {
      gridType: "triangle",
      property: "nitr_con",
      units: "kilometers",
      weight: kValue
    }

    workerInstance.terminate()
    workerInstance = worker()
    var triangleGrid

    workerInstance.addEventListener("message", message => {
      if (message.data.type === "FeatureCollection") {
        triangleGrid = message.data

        if (map.getLayer("idw-data") !== undefined) {
          map.removeLayer("idw-data")
          map.removeSource("idw-data")
        }

        map.addSource("idw-data", {
          type: "geojson",
          data: triangleGrid
        })

        map.addLayer({
          id: "idw-data",
          type: "fill-extrusion",
          source: "idw-data",
          layout: {
            visibility: "visible"
          },
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "nitr_con"],
              0,
              "#282728",
              8,
              "#B42222",
              16,
              "#fff"
            ],
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["get", "nitr_con"],
              0,
              -10000,
              16,
              250000
            ],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.7
          }
        })
        setActiveIDW(true)
        setLoading(false)
      }
    })
    workerInstance.calcStuff(geojsonWellNitrate, sizeValue, options)
  }

  const clickWN = () => {
    activeWN ? setActiveWN(false) : setActiveWN(true)
    map.setLayoutProperty(
      "well-nitrate-data",
      "visibility",
      activeWN ? "none" : "visible"
    )
  }

  const clickCT = () => {
    activeCT ? setActiveCT(false) : setActiveCT(true)
    map.setLayoutProperty(
      "cancer-tracts-data",
      "visibility",
      activeCT ? "none" : "visible"
    )
  }

  const clickIDW = () => {
    activeIDW ? setActiveIDW(false) : setActiveIDW(true)
    map.setLayoutProperty(
      "idw-data",
      "visibility",
      activeIDW ? "none" : "visible"
    )
  }

  const clickSR = () => {
    activeSR ? setActiveSR(false) : setActiveSR(true)
    map.setLayoutProperty(
      "spatial-regression-data",
      "visibility",
      activeSR ? "none" : "visible"
    )
  }

  const handleKSliderChange = (event, newValue) => {
    setLoading(true)
    setKValue(newValue)
    calcIDW(newValue, sizeValue)
  }

  const handleKInputChange = event => {
    setLoading(true)
    setKValue(event.target.value === "" ? "" : Number(event.target.value))
    if (event.target.value !== "") {
      calcIDW(Number(event.target.value), sizeValue)
    }
  }

  const handleSizeSliderChange = (event, newValue) => {
    setLoading(true)
    setSizeValue(newValue)
    calcIDW(kValue, newValue)
  }

  const handleSizeInputChange = event => {
    setLoading(true)
    setSizeValue(event.target.value === "" ? "" : Number(event.target.value))
    if (event.target.value !== "") {
      calcIDW(kValue, Number(event.target.value))
    }
  }

  const handleBlur = () => {
    if (kValue < 0) {
      setKValue(0)
    } else if (kValue > 5) {
      setKValue(5)
    }
  }

  return (
    <div>
      <div ref={el => (mapContainer.current = el)} style={styles} />
      <div className={classes.toggleGroup}>
        <ThemeProvider theme={uwTheme2}>
          <Card className={classes.card} elevation={8}>
            <CardContent>
              <Typography
                className={classes.typeHeaderBold}
                variant="h5"
                align="center"
              >
                Analytic Tools
              </Typography>
              <Typography
                className={classes.typeBold}
                variant="subtitle2"
                align="right"
              >
                Layer Toggles
              </Typography>
              <ButtonGroup
                orientation="vertical"
                color="primary"
                aria-label="vertical contained primary button group"
                variant="contained"
                className="layerButtons"
              >
                <StyledButton
                  color={activeWN ? "primary" : "secondary"}
                  onClick={clickWN}
                  startIcon={<LocalDrinkIcon />}
                  endIcon={<LocalDrinkIcon />}
                >
                  Well Nitrate Data
                </StyledButton>
                <StyledButton
                  color={activeCT ? "primary" : "secondary"}
                  onClick={clickCT}
                  startIcon={<HomeWorkIcon />}
                  endIcon={<HomeWorkIcon />}
                >
                  Census Tract Data
                </StyledButton>
                <StyledButton
                  color={activeIDW ? "primary" : "secondary"}
                  onClick={clickIDW}
                  startIcon={<BlurCircularIcon />}
                  endIcon={<BlurCircularIcon />}
                >
                  IDW Aggregation
                </StyledButton>
                <StyledButton
                  color={activeSR ? "primary" : "secondary"}
                  onClick={clickSR}
                  startIcon={<MultilineChartIcon />}
                  endIcon={<MultilineChartIcon />}
                >
                  Spatial Regression
                </StyledButton>
              </ButtonGroup>
              <Typography
                className={classes.typeBold}
                variant="subtitle2"
                align="right"
              >
                Inverse Distance Weight (k)
              </Typography>
              <div className={classes.kslider}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item>
                    <FitnessCenterIcon />
                  </Grid>
                  <Grid item xs>
                    <Slider
                      value={typeof kValue === "number" ? kValue : 0}
                      onChange={handleKSliderChange}
                      aria-labelledby="input-slider"
                      step={0.2}
                      min={1}
                      max={5}
                    />
                  </Grid>
                  <Grid item style={{ paddingRight: 0 }}>
                    <Input
                      className={classes.input}
                      value={kValue}
                      margin="dense"
                      onChange={handleKInputChange}
                      onBlur={handleBlur}
                      inputProps={{
                        step: 0.2,
                        min: 1,
                        max: 5,
                        type: "number",
                        "aria-labelledby": "input-slider"
                      }}
                    />
                  </Grid>
                </Grid>
              </div>
              <Typography
                className={classes.typeBold}
                variant="subtitle2"
                align="right"
              >
                Triangle Size (sqkm)
              </Typography>
              <div className={classes.kslider}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item>
                    <ChangeHistoryIcon />
                  </Grid>
                  <Grid item xs>
                    <Slider
                      value={typeof sizeValue === "number" ? sizeValue : 0}
                      onChange={handleSizeSliderChange}
                      aria-labelledby="input-s-slider"
                      step={5}
                      min={5}
                      max={35}
                    />
                  </Grid>
                  <Grid item style={{ paddingRight: 0 }}>
                    <Input
                      className={classes.input}
                      value={sizeValue}
                      margin="dense"
                      onChange={handleSizeInputChange}
                      onBlur={handleBlur}
                      inputProps={{
                        step: 5,
                        min: 5,
                        max: 35,
                        type: "number",
                        "aria-labelledby": "input-s-slider"
                      }}
                    />
                  </Grid>
                </Grid>
              </div>
            </CardContent>
          </Card>
          <div className={classes.loading}>{loading && <LinearProgress />}</div>
        </ThemeProvider>
      </div>
    </div>
  )
}

export default MapboxGLMap
