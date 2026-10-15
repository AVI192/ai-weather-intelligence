import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import CurrentWeather from './components/CurrentWeather'
import WeatherKpis from './components/WeatherKpis'
import WeatherInsights from './components/WeatherInsights'
import HourlyForecast from './components/HourlyForecast'
import DailyForecast from './components/DailyForecast'
import TemperatureChart from './components/TemperatureChart'
import HumidityWindChart from './components/HumidityWindChart'
import WeatherDistribution from './components/WeatherDistribution'
import SunriseSunset from './components/SunriseSunset'
import WeatherAlerts from './components/WeatherAlerts'
import CityComparison from './components/CityComparison'
import FavoriteCities from './components/FavoriteCities'
import RecentSearches from './components/RecentSearches'
import LoadingSkeleton from './components/LoadingSkeleton'
import ErrorState from './components/ErrorState'
import AIIntelligence from './components/AIIntelligence'

import { fetchCurrentWeather, fetchForecast, fetchUVIndex } from './services/weatherApi'
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  getFavoriteCities,
  toggleFavoriteCity,
  isFavoriteCity,
  getStoredTheme,
  setStoredTheme,
  getWeatherThemeClass
} from './utils/weatherUtils'

import './App.css'

const App = () => {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam) return tabParam
      if (window.location.hash) {
        const hash = window.location.hash.replace('#', '')
        if (hash) return hash
      }
    } catch {
      // fallback
    }
    return 'overview'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Weather data state
  const [currentWeather, setCurrentWeather] = useState(null)
  const [forecastData, setForecastData] = useState(null)
  const [uvIndex, setUvIndex] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeCity, setActiveCity] = useState('')

  // Preference & LocalStorage state
  const [unit, setUnit] = useState('C') // 'C' or 'F'
  const [theme, setTheme] = useState(getStoredTheme())
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [favoriteCities, setFavoriteCities] = useState(getFavoriteCities())

  // Request sequence ref to prevent stale response race conditions
  const searchIdRef = React.useRef(0)

  // Main weather search handler
  const handleSearch = useCallback(async (query) => {
    if (!query) return
    const requestId = ++searchIdRef.current

    setIsLoading(true)
    setErrorMessage('')

    try {
      const current = await fetchCurrentWeather(query)
      if (requestId !== searchIdRef.current) return

      const forecastTarget = current.coord ? { lat: current.coord.lat, lon: current.coord.lon } : query
      const forecast = await fetchForecast(forecastTarget)
      if (requestId !== searchIdRef.current) return

      // Compute accurate Min / Max temperature for current local day & 24h cycle in the city
      const cityTodayDateStr = new Date((current.dt + current.timezoneOffset) * 1000).toISOString().split('T')[0]
      const todayForecastItems = (forecast.list || []).filter(item => {
        const itemDateStr = new Date((item.dt + current.timezoneOffset) * 1000).toISOString().split('T')[0]
        return itemDateStr === cityTodayDateStr
      })
      const next24hItems = (forecast.list || []).slice(0, 8)

      // Use today's items if sufficient items exist; otherwise use 24-hour cycle window so late-night searches show realistic daily bounds
      const candidateItems = todayForecastItems.length >= 4 ? todayForecastItems : [...todayForecastItems, ...next24hItems]

      const tempsMin = candidateItems.map(i => typeof i.main?.temp_min === 'number' ? i.main.temp_min : (i.main?.temp ?? current.temperature))
      const tempsMax = candidateItems.map(i => typeof i.main?.temp_max === 'number' ? i.main.temp_max : (i.main?.temp ?? current.temperature))
      tempsMin.push(current.temperature)
      tempsMax.push(current.temperature)

      const computedMin = Math.min(...tempsMin)
      const computedMax = Math.max(...tempsMax)

      const enrichedCurrentWeather = {
        ...current,
        tempMin: computedMin,
        tempMax: computedMax
      }

      setCurrentWeather(enrichedCurrentWeather)
      setForecastData(forecast)
      setActiveCity(current.cityName)

      // Save search history
      const updatedRecent = addRecentSearch(current.cityName)
      setRecentSearches(updatedRecent)

      // Fetch UV Index
      if (current.coord && typeof current.coord.lat === 'number' && typeof current.coord.lon === 'number') {
        const uv = await fetchUVIndex(current.coord.lat, current.coord.lon)
        if (requestId === searchIdRef.current) {
          setUvIndex(uv)
        }
      } else {
        if (requestId === searchIdRef.current) {
          setUvIndex(null)
        }
      }
    } catch (err) {
      if (requestId === searchIdRef.current) {
        console.error('Weather load error:', err)
        setErrorMessage(err.message || 'Unable to retrieve weather data')
      }
    } finally {
      if (requestId === searchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  // Geolocation trigger
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    setErrorMessage('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }
        setIsLocating(false)
        await handleSearch(coords)
      },
      (error) => {
        setIsLocating(false)
        console.warn('Geolocation error:', error)
        let msg = 'Unable to access your current location.'
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please search by city name.'
        }
        setErrorMessage(msg)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Unit & Theme Toggles
  const handleToggleUnit = () => setUnit(prev => (prev === 'C' ? 'F' : 'C'))
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    setStoredTheme(nextTheme)
  }

  // Favorites & History Handlers
  const handleToggleFavorite = (cityName) => {
    const updatedFavs = toggleFavoriteCity(cityName)
    setFavoriteCities(updatedFavs)
  }
  const handleClearRecent = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  // Initial Load - Defaults to Pune, Maharashtra, India
  useEffect(() => {
    handleSearch('Pune')
  }, [handleSearch])

  // Compute theme modifier classes
  const weatherConditionClass = currentWeather
    ? getWeatherThemeClass(currentWeather.iconCode, currentWeather.weatherCondition)
    : 'theme-clear'
  const modeClass = theme === 'light' ? 'light-mode' : 'dark-mode'
  const isCurrentFav = currentWeather ? isFavoriteCity(currentWeather.cityName) : false

  return (
    <div className={`app-container ${modeClass} ${weatherConditionClass}`}>
      <div className="dashboard-layout">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Content Area */}
        <div className="dashboard-content-area">
          {/* Header Controls */}
          <Header
            theme={theme}
            onToggleTheme={handleToggleTheme}
            unit={unit}
            onToggleUnit={handleToggleUnit}
            onGeolocate={handleGeolocate}
            isLocating={isLocating}
            onSearch={handleSearch}
            isLoading={isLoading}
            timezoneOffset={currentWeather ? currentWeather.timezoneOffset : undefined}
          />

          {/* Quick Nav Chips (Rendered for standard dashboard tabs; AI page uses its own compact bar) */}
          {activeTab !== 'ai' && activeTab !== 'recent' && (
            <div className="quick-access-bar">
              <RecentSearches
                searches={recentSearches}
                onSelectCity={handleSearch}
                onClearHistory={handleClearRecent}
                activeCity={activeCity}
              />
            </div>
          )}

          {/* Main Dashboard Views */}
          <main className="main-viewport" aria-live="polite">
            {activeTab === 'ai' ? (
              <div className="view-grid ai-view">
                <AIIntelligence
                  weatherData={currentWeather}
                  recentSearches={recentSearches}
                  onSelectCity={handleSearch}
                  onClearHistory={handleClearRecent}
                  activeCity={activeCity}
                />
              </div>
            ) : isLoading ? (
              <LoadingSkeleton />
            ) : errorMessage ? (
              <ErrorState
                message={errorMessage}
                onRetry={() => handleSearch(activeCity || 'Pune')}
                onSearchDefault={() => handleSearch('Pune')}
              />
            ) : currentWeather ? (
              <>
                {/* 1. OVERVIEW TAB VIEW */}
                {activeTab === 'overview' && (
                  <div className="view-grid overview-grid">
                    {/* Primary Left Column */}
                    <div className="grid-main-col">
                      <CurrentWeather
                        weatherData={currentWeather}
                        unit={unit}
                        isFavorite={isCurrentFav}
                        onToggleFavorite={handleToggleFavorite}
                      />

                      <WeatherKpis
                        weatherData={currentWeather}
                        uvIndex={uvIndex}
                        unit={unit}
                      />

                      <HourlyForecast
                        forecastList={forecastData ? forecastData.list : []}
                        timezoneOffset={currentWeather.timezoneOffset}
                        unit={unit}
                      />

                      <TemperatureChart
                        forecastList={forecastData ? forecastData.list : []}
                        timezoneOffset={currentWeather.timezoneOffset}
                        unit={unit}
                      />
                    </div>

                    {/* Secondary Right Column */}
                    <div className="grid-side-col">
                      <SunriseSunset
                        sunrise={currentWeather.sunrise}
                        sunset={currentWeather.sunset}
                        timezoneOffset={currentWeather.timezoneOffset}
                      />

                      <WeatherInsights weatherData={{ ...currentWeather, uvIndex }} />

                      <DailyForecast
                        forecastList={forecastData ? forecastData.list : []}
                        timezoneOffset={currentWeather.timezoneOffset}
                        unit={unit}
                      />
                    </div>
                  </div>
                )}


                {/* 2. WEATHER INSIGHTS TAB VIEW */}
                {activeTab === 'insights' && (
                  <div className="view-grid insights-view">
                    <WeatherInsights weatherData={{ ...currentWeather, uvIndex }} />
                    <div className="charts-split-row">
                      <WeatherDistribution forecastList={forecastData ? forecastData.list : []} />
                      <HumidityWindChart
                        forecastList={forecastData ? forecastData.list : []}
                        timezoneOffset={currentWeather.timezoneOffset}
                      />
                    </div>
                  </div>
                )}

                {/* 3. FORECAST TAB VIEW */}
                {activeTab === 'forecast' && (
                  <div className="view-grid forecast-view">
                    <HourlyForecast
                      forecastList={forecastData ? forecastData.list : []}
                      timezoneOffset={currentWeather.timezoneOffset}
                      unit={unit}
                    />
                    <DailyForecast
                      forecastList={forecastData ? forecastData.list : []}
                      timezoneOffset={currentWeather.timezoneOffset}
                      unit={unit}
                    />
                    <TemperatureChart
                      forecastList={forecastData ? forecastData.list : []}
                      timezoneOffset={currentWeather.timezoneOffset}
                      unit={unit}
                    />
                  </div>
                )}

                {/* 4. FAVORITES TAB VIEW */}
                {activeTab === 'favorites' && (
                  <div className="view-grid favorites-view">
                    <FavoriteCities
                      favorites={favoriteCities}
                      onSelectCity={handleSearch}
                      onRemoveFavorite={handleToggleFavorite}
                      activeCity={activeCity}
                    />
                  </div>
                )}

                {/* 5. RECENT SEARCHES TAB VIEW */}
                {activeTab === 'recent' && (
                  <div className="view-grid recent-view">
                    <RecentSearches
                      searches={recentSearches}
                      onSelectCity={handleSearch}
                      onClearHistory={handleClearRecent}
                      activeCity={activeCity}
                    />
                  </div>
                )}

                {/* 6. WEATHER ALERTS TAB VIEW */}
                {activeTab === 'alerts' && (
                  <div className="view-grid alerts-view">
                    <WeatherAlerts weatherData={{ ...currentWeather, uvIndex }} />
                  </div>
                )}

                {/* 7. CITY COMPARISON TAB VIEW */}
                {activeTab === 'comparison' && (
                  <div className="view-grid comparison-view">
                    <CityComparison
                      defaultCities={['London', 'New York', 'Tokyo']}
                      unit={unit}
                      onSelectCity={handleSearch}
                    />
                  </div>
                )}

                {/* 8. SETTINGS TAB VIEW */}
                {activeTab === 'settings' && (
                  <div className="view-grid settings-view">
                    <div className="settings-card">
                      <h3>Dashboard Preferences</h3>
                      <div className="setting-item-row">
                        <div>
                          <strong>Temperature Unit</strong>
                          <p>Switch between Celsius (°C) and Fahrenheit (°F)</p>
                        </div>
                        <button className="settings-toggle-btn" onClick={handleToggleUnit}>
                          Currently: °{unit}
                        </button>
                      </div>
                      <div className="setting-item-row">
                        <div>
                          <strong>Theme Mode</strong>
                          <p>Toggle Dark SaaS theme or Warm Editorial Light mode</p>
                        </div>
                        <button className="settings-toggle-btn" onClick={handleToggleTheme}>
                          Currently: {theme.toUpperCase()}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </main>

          <footer className="app-footer">
            <p>WeatherPulse Dashboard • Powered by OpenWeatherMap & OpenMeteo API</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
