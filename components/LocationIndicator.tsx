'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Globe, 
  MapPin, 
  Settings, 
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react'

interface ProxyPreferences {
  id: string
  user_id: string
  preferred_country: string
  preferred_state?: string
  preferred_city?: string
  linkedin_location?: string
  is_linkedin_based: boolean
  is_auto_assigned: boolean
  confidence_score?: number
  session_id: string
  created_at: string
  last_updated: string
}

interface LocationOption {
  country: string
  state?: string
  displayName: string
  priority: number
}

// Country code to flag emoji mapping
const countryFlags: { [key: string]: string } = {
  'us': '🇺🇸',
  'gb': '🇬🇧', 
  'ca': '🇨🇦',
  'de': '🇩🇪',
  'fr': '🇫🇷',
  'au': '🇦🇺',
  'nl': '🇳🇱',
  'br': '🇧🇷',
  'es': '🇪🇸',
  'it': '🇮🇹',
  'jp': '🇯🇵',
  'sg': '🇸🇬',
  'in': '🇮🇳'
}

// Available locations from AutoIPAssignmentService
const availableLocations: LocationOption[] = [
  { country: 'us', displayName: 'United States', priority: 1 },
  { country: 'us', state: 'ca', displayName: 'United States (California)', priority: 1 },
  { country: 'us', state: 'ny', displayName: 'United States (New York)', priority: 1 },
  { country: 'us', state: 'tx', displayName: 'United States (Texas)', priority: 1 },
  { country: 'us', state: 'fl', displayName: 'United States (Florida)', priority: 1 },
  { country: 'us', state: 'il', displayName: 'United States (Illinois)', priority: 1 },
  { country: 'us', state: 'wa', displayName: 'United States (Washington)', priority: 1 },
  { country: 'gb', displayName: 'United Kingdom', priority: 2 },
  { country: 'ca', displayName: 'Canada', priority: 2 },
  { country: 'de', displayName: 'Germany', priority: 2 },
  { country: 'fr', displayName: 'France', priority: 2 },
  { country: 'au', displayName: 'Australia', priority: 2 },
  { country: 'nl', displayName: 'Netherlands', priority: 3 },
  { country: 'br', displayName: 'Brazil', priority: 3 },
  { country: 'es', displayName: 'Spain', priority: 3 },
  { country: 'it', displayName: 'Italy', priority: 3 },
  { country: 'jp', displayName: 'Japan', priority: 4 },
  { country: 'sg', displayName: 'Singapore', priority: 4 },
  { country: 'in', displayName: 'India', priority: 5 }
]

export default function LocationIndicator() {
  const [preferences, setPreferences] = useState<ProxyPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState('')

  const fetchPreferences = async () => {
    try {
      setError(null)
      const response = await fetch('/api/bright-data/proxy-preferences')
      
      if (!response.ok) {
        throw new Error('Failed to fetch proxy preferences')
      }

      const data = await response.json()
      console.log('📍 Fetched proxy preferences:', data)
      
      setPreferences(data.preferences)
    } catch (error) {
      console.error('❌ Error fetching proxy preferences:', error)
      setError(error instanceof Error ? error.message : 'Failed to load location')
    } finally {
      setLoading(false)
    }
  }

  const updateLocation = async (location: LocationOption) => {
    try {
      setUpdating(true)
      setError(null)

      const response = await fetch('/api/bright-data/proxy-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferred_country: location.country,
          preferred_state: location.state,
          preferred_city: null // Could be extended later
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update location')
      }

      const data = await response.json()
      console.log('✅ Updated proxy location:', data)
      
      setPreferences(data.preferences)
      setIsDialogOpen(false)
      
    } catch (error) {
      console.error('❌ Error updating location:', error)
      setError(error instanceof Error ? error.message : 'Failed to update location')
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    fetchPreferences()
  }, [])

  const getLocationDisplay = () => {
    if (!preferences) {
      return {
        flag: '🌍',
        name: 'No location set',
        isLinkedInBased: false,
        isAutoAssigned: false
      }
    }
    
    const country = preferences.preferred_country
    const state = preferences.preferred_state
    const flag = countryFlags[country] || '🌍'
    
    const location = availableLocations.find(
      loc => loc.country === country && loc.state === state
    ) || availableLocations.find(loc => loc.country === country)
    
    return {
      flag,
      name: location?.displayName || `${country.toUpperCase()}${state ? ` (${state.toUpperCase()})` : ''}`,
      isLinkedInBased: preferences.is_linkedin_based,
      isAutoAssigned: preferences.is_auto_assigned
    }
  }

  const locationDisplay = getLocationDisplay()

  if (loading) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-800">Loading location...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">Location error</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchPreferences}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If no preferences set up yet, show setup option
  if (!preferences) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <div className="text-sm font-medium text-blue-800">
                  No proxy location set
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-blue-600" />
                  <span className="text-xs text-blue-600">Set up your proxy location</span>
                </div>
              </div>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Set Location
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Set Proxy Location
                  </DialogTitle>
                  <DialogDescription>
                    Choose your preferred proxy location for Bright Data connections. This affects how your LinkedIn and web scraping requests appear globally.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Location</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocations.map((location) => {
                          const key = `${location.country}-${location.state || 'default'}`
                          const flag = countryFlags[location.country] || '🌍'
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <span>{flag}</span>
                                <span>{location.displayName}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Recommended: United States (California)</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Best performance for LinkedIn and most web scraping tasks
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setIsDialogOpen(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const location = availableLocations.find(
                          loc => `${loc.country}-${loc.state || 'default'}` === selectedLocation
                        )
                        if (location) {
                          updateLocation(location)
                        }
                      }}
                      disabled={!selectedLocation || updating}
                      className="flex-1"
                    >
                      {updating ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Set Location
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{locationDisplay.flag}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-800">
                    {locationDisplay.name}
                  </span>
                  {locationDisplay.isLinkedInBased && (
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                      LinkedIn
                    </Badge>
                  )}
                  {locationDisplay.isAutoAssigned && !locationDisplay.isLinkedInBased && (
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                      Auto
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">Proxy Location</span>
                </div>
              </div>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                <Settings className="h-3 w-3 mr-1" />
                Change
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Change Proxy Location
                </DialogTitle>
                <DialogDescription>
                  Select your preferred proxy location for Bright Data connections. This affects how your LinkedIn and web scraping requests appear globally.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Location</label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLocations.map((location) => {
                        const key = `${location.country}-${location.state || 'default'}`
                        const flag = countryFlags[location.country] || '🌍'
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span>{flag}</span>
                              <span>{location.displayName}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                {preferences?.is_linkedin_based && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Currently using LinkedIn location</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Your proxy location was automatically set based on your LinkedIn profile location: {preferences.linkedin_location}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsDialogOpen(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const location = availableLocations.find(
                        loc => `${loc.country}-${loc.state || 'default'}` === selectedLocation
                      )
                      if (location) {
                        updateLocation(location)
                      }
                    }}
                    disabled={!selectedLocation || updating}
                    className="flex-1"
                  >
                    {updating ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Update Location
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}