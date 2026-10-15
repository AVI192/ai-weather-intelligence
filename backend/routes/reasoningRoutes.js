import { Router } from 'express'

import {
  getCurrentWeather
} from '../services/openWeatherService.js'

import {
  reasonAboutWeather
} from '../agents/weatherReasoningAgent.js'

const router = Router()

const getCoordinates = (req) => {
  const lat = Number(req.query.lat)
  const lon = Number(req.query.lon)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    throw new Error(
      'Valid lat and lon query parameters are required.'
    )
  }

  return {
    lat,
    lon
  }
}

router.get('/weather-reasoning', async (req, res) => {
  try {
    const { lat, lon } =
      getCoordinates(req)

    const current =
      await getCurrentWeather(lat, lon)

    const currentData = {
      cityName:
        current?.name || '',

      country:
        current?.sys?.country || '',

      coord: {
        lat:
          current?.coord?.lat,

        lon:
          current?.coord?.lon
      },

      temperature:
        current?.main?.temp,

      feelsLike:
        current?.main?.feels_like,

      humidity:
        current?.main?.humidity,

      pressure:
        current?.main?.pressure,

      visibility:
        typeof current?.visibility === 'number'
          ? current.visibility / 1000
          : null,

      windSpeed:
        typeof current?.wind?.speed === 'number'
          ? current.wind.speed * 3.6
          : null,

      weatherCondition:
        current?.weather?.[0]?.main || '',

      weatherDescription:
        current?.weather?.[0]?.description || '',

      iconCode:
        current?.weather?.[0]?.icon || '',

      dt:
        current?.dt || null
    }

    const reasoningInput = {
      temperatureCelsius:
        currentData.temperature,

      feelsLikeCelsius:
        currentData.feelsLike,

      humidityPercent:
        currentData.humidity,

      windSpeedKmh:
        currentData.windSpeed,

      rainProbability:
        null,

      condition:
        currentData.weatherCondition
    }

    const result =
      reasonAboutWeather({
        current: reasoningInput
      })

    res.json({
      success: true,
      data: {
        ...result,

        location: {
          city:
            currentData.cityName,

          country:
            currentData.country
        }
      }
    })
  } catch (error) {
    console.error(
      'Weather Reasoning Agent error:',
      error
    )

    res.status(500).json({
      success: false,
      message:
        error.message ||
        'Weather Reasoning Agent failed.'
    })
  }
})

export default router