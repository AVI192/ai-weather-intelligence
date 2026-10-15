const isNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value)

const createCheck = (
  name,
  valid,
  value,
  message
) => ({
  name,
  valid,
  value,
  message
})

const validateCurrentWeather = (current) => {
  const checks = []

  checks.push(
    createCheck(
      'Temperature',
      isNumber(current?.temperature) &&
        current.temperature >= -90 &&
        current.temperature <= 60,
      current?.temperature,
      'Temperature must be between -90°C and 60°C.'
    )
  )

  checks.push(
    createCheck(
      'Feels Like Temperature',
      isNumber(current?.feelsLike) &&
        current.feelsLike >= -90 &&
        current.feelsLike <= 60,
      current?.feelsLike,
      'Feels-like temperature must be between -90°C and 60°C.'
    )
  )

  checks.push(
    createCheck(
      'Humidity',
      isNumber(current?.humidity) &&
        current.humidity >= 0 &&
        current.humidity <= 100,
      current?.humidity,
      'Humidity must be between 0% and 100%.'
    )
  )

  checks.push(
    createCheck(
      'Pressure',
      isNumber(current?.pressure) &&
        current.pressure >= 800 &&
        current.pressure <= 1100,
      current?.pressure,
      'Pressure must be within a reasonable atmospheric range.'
    )
  )

  checks.push(
    createCheck(
      'Wind Speed',
      isNumber(current?.windSpeed) &&
        current.windSpeed >= 0 &&
        current.windSpeed <= 200,
      current?.windSpeed,
      'Wind speed must be between 0 and 200 km/h.'
    )
  )

  checks.push(
    createCheck(
      'Visibility',
      current?.visibility == null ||
        (
          isNumber(current?.visibility) &&
          current.visibility >= 0 &&
          current.visibility <= 100
        ),
      current?.visibility,
      'Visibility must be between 0 and 100 km.'
    )
  )

  checks.push(
    createCheck(
      'Coordinates',
      isNumber(current?.coord?.lat) &&
        isNumber(current?.coord?.lon) &&
        current.coord.lat >= -90 &&
        current.coord.lat <= 90 &&
        current.coord.lon >= -180 &&
        current.coord.lon <= 180,
      current?.coord,
      'Coordinates must contain valid latitude and longitude.'
    )
  )

  return checks
}

const validateUV = (uvIndex) => {
  return createCheck(
    'UV Index',
    uvIndex == null ||
      (
        isNumber(uvIndex) &&
        uvIndex >= 0 &&
        uvIndex <= 20
      ),
    uvIndex,
    'UV index must be between 0 and 20.'
  )
}

const validateForecast = (forecast) => {
  const list = Array.isArray(forecast?.list)
    ? forecast.list
    : []

  const hasForecastData = list.length > 0

  const validEntries = list.filter((item) => {
    const temperature =
      item?.main?.temp

    const humidity =
      item?.main?.humidity

    const wind =
      item?.wind?.speed

    return (
      isNumber(temperature) &&
      temperature >= -90 &&
      temperature <= 60 &&
      isNumber(humidity) &&
      humidity >= 0 &&
      humidity <= 100 &&
      isNumber(wind) &&
      wind >= 0 &&
      wind <= 200
    )
  })

  const validRatio =
    hasForecastData
      ? validEntries.length / list.length
      : 0

  return {
    check: createCheck(
      'Forecast Data',
      hasForecastData && validRatio >= 0.9,
      {
        totalRecords: list.length,
        validRecords: validEntries.length
      },
      'At least 90% of forecast records should contain valid core weather values.'
    ),
    totalRecords: list.length,
    validRecords: validEntries.length,
    validRatio
  }
}

const normalizeWeatherData = (
  current,
  forecast,
  uv
) => {
  const forecastList = Array.isArray(forecast?.list)
    ? forecast.list
    : []

  return {
    current: {
      cityName: current?.cityName || '',
      state: current?.state || '',
      country: current?.country || '',

      coordinates: {
        latitude: current?.coord?.lat ?? null,
        longitude: current?.coord?.lon ?? null
      },

      temperatureCelsius:
        isNumber(current?.temperature)
          ? current.temperature
          : null,

      feelsLikeCelsius:
        isNumber(current?.feelsLike)
          ? current.feelsLike
          : null,

      humidityPercent:
        isNumber(current?.humidity)
          ? current.humidity
          : null,

      pressureHpa:
        isNumber(current?.pressure)
          ? current.pressure
          : null,

      windSpeedKmh:
        isNumber(current?.windSpeed)
          ? current.windSpeed
          : null,

      visibilityKm:
        isNumber(current?.visibility)
          ? current.visibility
          : null,

      condition:
        current?.weatherCondition || '',

      description:
        current?.weatherDescription || '',

      icon:
        current?.iconCode || '',

      timestamp:
        current?.dt || null
    },

    uvIndex:
      isNumber(uv)
        ? uv
        : null,

    forecast: {
      city:
        forecast?.city || '',

      country:
        forecast?.country || '',

      timezoneOffset:
        forecast?.timezoneOffset || 0,

      recordCount:
        forecastList.length,

      records:
        forecastList.map((item) => ({
          timestamp:
            item?.dt || null,

          temperatureCelsius:
            isNumber(item?.main?.temp)
              ? item.main.temp
              : null,

          feelsLikeCelsius:
            isNumber(item?.main?.feels_like)
              ? item.main.feels_like
              : null,

          humidityPercent:
            isNumber(item?.main?.humidity)
              ? item.main.humidity
              : null,

          pressureHpa:
            isNumber(item?.main?.pressure)
              ? item.main.pressure
              : null,

          windSpeedKmh:
            isNumber(item?.wind?.speed)
              ? Math.round(
                  item.wind.speed * 3.6 * 10
                ) / 10
              : null,

          windDirection:
            isNumber(item?.wind?.deg)
              ? item.wind.deg
              : null,

          cloudPercent:
            isNumber(item?.clouds?.all)
              ? item.clouds.all
              : null,

          rainProbability:
            isNumber(item?.pop)
              ? item.pop
              : null,

          visibilityKm:
            isNumber(item?.visibility)
              ? item.visibility / 1000
              : null,

          condition:
            item?.weather?.[0]?.main || '',

          description:
            item?.weather?.[0]?.description || ''
        }))
    }
  }
}

export const analyzeWeatherData = ({
  current,
  forecast,
  uv
}) => {
  const currentChecks =
    validateCurrentWeather(current)

  const uvCheck =
    validateUV(uv)

  const forecastResult =
    validateForecast(forecast)

  const allChecks = [
    ...currentChecks,
    uvCheck,
    forecastResult.check
  ]

  const validChecks =
    allChecks.filter(
      (check) => check.valid
    ).length

  const totalChecks =
    allChecks.length

  const validationScore =
    totalChecks > 0
      ? Math.round(
          (validChecks / totalChecks) * 100
        )
      : 0

  const currentComplete =
    currentChecks.every(
      (check) =>
        check.valid &&
        check.value !== null &&
        check.value !== undefined
    )

  const forecastAvailable =
    forecastResult.totalRecords > 0

  const completenessScore =
    (
      (currentComplete ? 70 : 0) +
      (forecastAvailable ? 30 : 0)
    )

  const qualityScore = Math.round(
    validationScore * 0.7 +
    completenessScore * 0.3
  )

  let status = 'READY'

  if (qualityScore < 60) {
    status = 'INSUFFICIENT'
  } else if (qualityScore < 80) {
    status = 'DEGRADED'
  }

  const normalizedData =
    normalizeWeatherData(
      current,
      forecast,
      uv
    )

  return {
    agent: {
      name: 'Data Intelligence Agent',
      version: '1.0.0',
      status: 'completed'
    },

    dataQuality: {
      score: qualityScore,
      status,

      validationScore,

      completenessScore,

      validChecks,
      totalChecks,

      forecastRecords:
        forecastResult.totalRecords,

      validForecastRecords:
        forecastResult.validRecords
    },

    checks: allChecks,

    normalizedData,

    decision: {
      readyForAI:
        qualityScore >= 80,

      reason:
        qualityScore >= 80
          ? 'Weather data passed the required validation checks and is ready for downstream AI agents.'
          : 'Weather data requires additional validation before downstream AI decision-making.'
    }
  }
}