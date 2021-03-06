import regression from "regression"
import { standardDeviation } from "simple-statistics"
import intersect from "@turf/intersect"

// Regression things
export const regressionStuff = (hexNitrate, hexCancer, wisc) => {
  // Merge the data into hexNitrate prior to regression fit
  var data = []
  for (const [ind, val] of hexCancer.features.entries()) {
    hexNitrate.features[ind].properties.canrate = val.properties.canrate
    data.push([
      hexNitrate.features[ind].properties.nitr_con,
      hexNitrate.features[ind].properties.canrate
    ])
  }

  // Execute regression fit
  const output = regression.linear(data, { order: 2, precision: 4 })

  // Populate predicted cancer values array for
  // standard deviation calculation
  var residuals = []
  for (const [ind, val] of hexNitrate.features.entries()) {
    var pred = output.predict(val.properties.nitr_con)
    residuals.push(val.properties.canrate - pred[1])
    hexNitrate.features[ind].properties.pred_canrate = pred[1]
    hexNitrate.features[ind].properties.res = val.properties.canrate - pred[1]
    hexNitrate.features[ind].properties.r2 = output.r2
    hexNitrate.features[ind].properties.eq = output.string
  }

  // Calulcate standard deviation
  const std_dev = standardDeviation(residuals)

  // Use regression fit and standard deviation
  // to enrich the hexNitrate geoJson
  for (const [ind, val] of hexNitrate.features.entries()) {
    // Store slope and offset in data
    hexNitrate.features[ind].properties.m = output.equation[0]
    hexNitrate.features[ind].properties.c = output.equation[1]

    // Store residuals, standard residuals,
    // and standard deviation in data
    hexNitrate.features[ind].properties.std_res =
      hexNitrate.features[ind].properties.res / std_dev
    hexNitrate.features[ind].properties.abs_val_std_res = Math.abs(
      hexNitrate.features[ind].properties.std_res
    )
    hexNitrate.features[ind].properties.std_dev = std_dev

    // Mask for only Wisconsin intersecting geoms
    if (intersect(val, wisc) === null) {
      hexNitrate.features[ind].properties.res = -99
      hexNitrate.features[ind].properties.pred_canrate = -99
      hexNitrate.features[ind].properties.std_res = -99
      hexNitrate.features[ind].properties.std_dev = -99
      hexNitrate.features[ind].properties.abs_val_std_res = -99
    }
  }

  postMessage(hexNitrate)
}
