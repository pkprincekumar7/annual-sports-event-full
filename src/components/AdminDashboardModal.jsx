/**
 * Admin Dashboard Modal
 * Main admin panel for managing Event Years, Sports, and Departments
 */

import { useState, useEffect, useRef } from 'react'
import { useEventYear } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import { clearSportManagementCaches } from '../utils/cacheHelpers'
import { buildApiUrlWithYear } from '../utils/apiHelpers'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Input from './ui/Input'
import DatePickerInput from './ui/DatePickerInput'
import LoadingSpinner from './ui/LoadingSpinner'
import ErrorMessage from './ui/ErrorMessage'
import { formatSportName } from '../utils/stringHelpers'
import ConfirmationDialog from './ui/ConfirmationDialog'
import EventYearSelector from './EventYearSelector'
import { validateDateRelationships, getUpdatableDateFields } from '../utils/yearHelpers'

const TABS = {
  EVENT_YEARS: 'event_years',
  SPORTS: 'sports',
  DEPARTMENTS: 'departments'
}

function AdminDashboardModal({ isOpen, onClose, onStatusPopup, selectedEventYear, onEventYearChange, loggedInUser }) {
  const [activeTab, setActiveTab] = useState(TABS.EVENT_YEARS)
  const { eventYear: activeEventYear, eventYearConfig } = useEventYear()
  // Use selectedEventYear if admin selected one, otherwise use active event year
  const currentEventYear = selectedEventYear || activeEventYear
  const currentEventName = eventYearConfig?.event_name || null

  // Event Years State
  const [eventYears, setEventYears] = useState([])
  const [eventYearForm, setEventYearForm] = useState({
    event_year: '',
    event_name: '',
    event_organizer: '',
    event_title: '',
    event_highlight: '',
    event_dates: { start: '', end: '' },
    registration_dates: { start: '', end: '' }
  })
  const [editingEventYear, setEditingEventYear] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [loadingEventYears, setLoadingEventYears] = useState(false)
  const [loadingSports, setLoadingSports] = useState(false)
  const [loadingDepts, setLoadingDepts] = useState(false)

  // Sports State
  const [sports, setSports] = useState([])
  const [sportForm, setSportForm] = useState({
    name: '',
    type: '',
    category: '',
    team_size: '',
    imageUri: ''
  })
  const [editingSport, setEditingSport] = useState(null)
  const [showDeleteSportConfirm, setShowDeleteSportConfirm] = useState(null)

  // Departments State
  const [departments, setDepartments] = useState([])
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    display_order: 0
  })
  const [editingDept, setEditingDept] = useState(null)
  const [showDeleteDeptConfirm, setShowDeleteDeptConfirm] = useState(null)

  // Fetch data when tab changes or selectedEventYear changes
  useEffect(() => {
    if (!isOpen) return

    if (activeTab === TABS.EVENT_YEARS) {
      fetchEventYearsData()
    } else if (activeTab === TABS.SPORTS) {
      // Fetch both event years (for validation) and sports data
      fetchEventYearsData()
      fetchSportsData()
    } else if (activeTab === TABS.DEPARTMENTS) {
      fetchDepartmentsData()
    }
  }, [isOpen, activeTab, currentEventYear])

  // Fetch Event Years
  const fetchEventYearsData = async () => {
    setLoadingEventYears(true)
    try {
      const response = await fetchWithAuth('/api/event-years')
      
      if (!response.ok) {
        // Only show error for actual server errors (5xx), not for empty data or 404
        if (response.status >= 500) {
          onStatusPopup('❌ Failed to fetch event years', 'error', 3000)
        }
        // For other status codes, don't clear existing data (preserve optimistic updates)
        return
      }
      const data = await response.json()
      // Backend returns { success: true, eventYears: [...] }
      const eventYearsData = data.eventYears || (Array.isArray(data) ? data : [])
      // Always update with fresh data from server (this will include the newly created event year)
      setEventYears(Array.isArray(eventYearsData) ? eventYearsData.sort((a, b) => b.event_year - a.event_year) : [])
    } catch (error) {
      // Only show error popup for actual network errors (not empty data)
      // Network errors typically have message like "Failed to fetch" or "NetworkError"
      if (error.name === 'TypeError' || error.message?.includes('fetch')) {
        onStatusPopup('❌ Failed to fetch event years', 'error', 3000)
        // Only clear data on actual network errors if we have no data (preserve optimistic updates)
        if (eventYears.length === 0) {
          setEventYears([])
        }
      }
      // Don't clear existing data on other errors (preserve optimistic updates)
    } finally {
      setLoadingEventYears(false)
    }
  }

  // Fetch Sports
  const fetchSportsData = async () => {
    setLoadingSports(true)
    try {
      const response = await fetchWithAuth(`/api/sports${currentEventYear ? `?event_year=${currentEventYear}` : ''}`)
      if (!response.ok) {
        // Only show error for actual server errors (5xx), not for empty data
        if (response.status >= 500) {
          onStatusPopup('❌ Failed to fetch sports', 'error', 3000)
        }
        // For other status codes (like 404), just treat as empty data (no error popup)
        setSports([])
        return
      }
      const data = await response.json()
      setSports(data.sports || data || [])
    } catch (error) {
      // Only show error popup for actual network errors (not empty data)
      if (error.name === 'TypeError' || error.message?.includes('fetch')) {
        onStatusPopup('❌ Failed to fetch sports', 'error', 3000)
      }
      setSports([])
    } finally {
      setLoadingSports(false)
    }
  }

  // Fetch Departments
  const fetchDepartmentsData = async () => {
    setLoadingDepts(true)
    try {
      const response = await fetchWithAuth('/api/departments')
      if (!response.ok) {
        // Only show error for actual server errors (5xx), not for empty data
        if (response.status >= 500) {
          onStatusPopup('❌ Failed to fetch departments', 'error', 3000)
        }
        // For other status codes (like 404), just treat as empty data (no error popup)
        setDepartments([])
        return
      }
      const data = await response.json()
      setDepartments(data.departments || data || [])
    } catch (error) {
      // Only show error popup for actual network errors (not empty data)
      if (error.name === 'TypeError' || error.message?.includes('fetch')) {
        onStatusPopup('❌ Failed to fetch departments', 'error', 3000)
      }
      setDepartments([])
    } finally {
      setLoadingDepts(false)
    }
  }

  // Event Year Handlers
  const handleCreateEventYear = async (e) => {
    e.preventDefault()
    
    // Client-side validation: Check date relationships
    const dateValidation = validateDateRelationships(eventYearForm.registration_dates, eventYearForm.event_dates)
    if (!dateValidation.isValid) {
      onStatusPopup(`❌ ${dateValidation.error}`, 'error', 3000)
      return
    }
    
    // Client-side validation: Check past dates
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const regStart = new Date(eventYearForm.registration_dates.start + 'T00:00:00')
    regStart.setHours(0, 0, 0, 0)
    if (regStart < now) {
      onStatusPopup('❌ Registration start date cannot be in the past. Event creation is only allowed for current or future dates.', 'error', 3000)
      return
    }
    
    const eventStart = new Date(eventYearForm.event_dates.start + 'T00:00:00')
    eventStart.setHours(0, 0, 0, 0)
    if (eventStart < now) {
      onStatusPopup('❌ Event start date cannot be in the past. Event creation is only allowed for current or future dates.', 'error', 3000)
      return
    }
    
    try {
      const response = await fetchWithAuth('/api/event-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_year: eventYearForm.event_year,
          event_name: eventYearForm.event_name,
          event_organizer: eventYearForm.event_organizer || undefined,
          event_title: eventYearForm.event_title || undefined,
          event_highlight: eventYearForm.event_highlight || undefined,
          event_dates: {
            start: new Date(eventYearForm.event_dates.start + 'T00:00:00'),
            end: new Date(eventYearForm.event_dates.end + 'T23:59:59')
          },
          registration_dates: {
            start: new Date(eventYearForm.registration_dates.start + 'T00:00:00'),
            end: new Date(eventYearForm.registration_dates.end + 'T23:59:59')
          }
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create event year')
      }
      const createdYear = await response.json()
      clearCache('/api/event-years/active')
      // Dispatch custom event to trigger refetch in all components using useEventYear hook
      window.dispatchEvent(new CustomEvent('eventYearUpdated'))
      onStatusPopup('✅ Event year created successfully', 'success', 2500)
      setEventYearForm({ event_year: '', event_name: '', event_organizer: '', event_title: '', event_highlight: '', event_dates: { start: '', end: '' }, registration_dates: { start: '', end: '' } })
      // Add the newly created year to the list immediately (optimistic update)
      setEventYears(prev => {
        // Check if year already exists to avoid duplicates
        const exists = prev.some(y => y._id === createdYear._id || y.event_year === createdYear.event_year)
        if (exists) {
          return prev.map(y => y._id === createdYear._id || y.event_year === createdYear.event_year ? createdYear : y).sort((a, b) => b.event_year - a.event_year)
        }
        return [createdYear, ...prev].sort((a, b) => b.event_year - a.event_year)
      })
      // Refetch after a short delay to ensure consistency with server
      setTimeout(() => {
        fetchEventYearsData()
      }, 300)
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }


  const handleUpdateEventYear = async (e) => {
    e.preventDefault()
    if (!editingEventYear) return
    
    // Get updatable fields based on current date
    const updatableFields = getUpdatableDateFields(editingEventYear)
    
    // Client-side validation: Check if trying to update restricted non-date fields
    if (!updatableFields.canUpdateNonDateFields && (
      eventYearForm.event_name !== editingEventYear.event_name ||
      eventYearForm.event_organizer !== (editingEventYear.event_organizer || '') ||
      eventYearForm.event_title !== (editingEventYear.event_title || '') ||
      eventYearForm.event_highlight !== (editingEventYear.event_highlight || '')
    )) {
      onStatusPopup('❌ Cannot update event configuration. The event has already ended.', 'error', 3000)
      return
    }
    
    // Build update data with only allowed fields
    const updateData = {}
    
    // Add non-date fields if allowed
    if (updatableFields.canUpdateNonDateFields) {
      updateData.event_name = eventYearForm.event_name
      updateData.event_organizer = eventYearForm.event_organizer ? eventYearForm.event_organizer.trim() : ''
      updateData.event_title = eventYearForm.event_title ? eventYearForm.event_title.trim() : ''
      updateData.event_highlight = eventYearForm.event_highlight ? eventYearForm.event_highlight.trim() : ''
    }
    
    // Build date objects with only allowed fields
    const regDates = {}
    const eventDates = {}
    let hasRegDates = false
    let hasEventDates = false
    
    if (updatableFields.canUpdateRegStart || updatableFields.canUpdateRegEnd) {
      if (updatableFields.canUpdateRegStart) {
        regDates.start = new Date(eventYearForm.registration_dates.start + 'T00:00:00')
        hasRegDates = true
      }
      if (updatableFields.canUpdateRegEnd) {
        regDates.end = new Date(eventYearForm.registration_dates.end + 'T23:59:59')
        hasRegDates = true
      }
      if (hasRegDates) {
        updateData.registration_dates = regDates
      }
    }
    
    if (updatableFields.canUpdateEventStart || updatableFields.canUpdateEventEnd) {
      if (updatableFields.canUpdateEventStart) {
        eventDates.start = new Date(eventYearForm.event_dates.start + 'T00:00:00')
        hasEventDates = true
      }
      if (updatableFields.canUpdateEventEnd) {
        eventDates.end = new Date(eventYearForm.event_dates.end + 'T23:59:59')
        hasEventDates = true
      }
      if (hasEventDates) {
        updateData.event_dates = eventDates
      }
    }
    
    // Client-side validation: Check date relationships if dates are being updated
    if (hasRegDates || hasEventDates) {
      // Merge with existing dates for validation (use form values or existing dates)
      const finalRegDates = {
        start: updatableFields.canUpdateRegStart 
          ? eventYearForm.registration_dates.start 
          : (editingEventYear.registration_dates.start ? new Date(editingEventYear.registration_dates.start).toISOString().split('T')[0] : ''),
        end: updatableFields.canUpdateRegEnd 
          ? eventYearForm.registration_dates.end 
          : (editingEventYear.registration_dates.end ? new Date(editingEventYear.registration_dates.end).toISOString().split('T')[0] : '')
      }
      const finalEventDates = {
        start: updatableFields.canUpdateEventStart 
          ? eventYearForm.event_dates.start 
          : (editingEventYear.event_dates.start ? new Date(editingEventYear.event_dates.start).toISOString().split('T')[0] : ''),
        end: updatableFields.canUpdateEventEnd 
          ? eventYearForm.event_dates.end 
          : (editingEventYear.event_dates.end ? new Date(editingEventYear.event_dates.end).toISOString().split('T')[0] : '')
      }
      
      const dateValidation = validateDateRelationships(finalRegDates, finalEventDates)
      if (!dateValidation.isValid) {
        onStatusPopup(`❌ ${dateValidation.error}`, 'error', 3000)
        return
      }
    }
    
    try {
      const response = await fetchWithAuth(`/api/event-years/${editingEventYear.event_year}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update event year')
      }
      clearCache('/api/event-years/active')
      // Dispatch custom event to trigger refetch in all components using useEventYear hook
      window.dispatchEvent(new CustomEvent('eventYearUpdated'))
      onStatusPopup('✅ Event year updated successfully', 'success', 2500)
      setEditingEventYear(null)
      setEventYearForm({ event_year: '', event_name: '', event_organizer: '', event_title: '', event_highlight: '', event_dates: { start: '', end: '' }, registration_dates: { start: '', end: '' } })
      fetchEventYearsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleEditEventYear = (eventYear) => {
    setEditingEventYear(eventYear)
    // Format dates for date input (YYYY-MM-DD)
    const formatDateForInput = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    setEventYearForm({
      event_year: eventYear.event_year.toString(),
      event_name: eventYear.event_name,
      event_organizer: eventYear.event_organizer || '',
      event_title: eventYear.event_title || '',
      event_highlight: eventYear.event_highlight || '',
      event_dates: {
        start: formatDateForInput(eventYear.event_dates.start),
        end: formatDateForInput(eventYear.event_dates.end)
      },
      registration_dates: {
        start: formatDateForInput(eventYear.registration_dates.start),
        end: formatDateForInput(eventYear.registration_dates.end)
      }
    })
  }

  const handleDeleteEventYear = async (eventYear) => {
    try {
      const response = await fetchWithAuth(`/api/event-years/${eventYear}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete event year')
      }
      clearCache('/api/event-years/active')
      // Dispatch custom event to trigger refetch in all components using useEventYear hook
      window.dispatchEvent(new CustomEvent('eventYearUpdated'))
      onStatusPopup('✅ Event year deleted successfully', 'success', 2500)
      setShowDeleteConfirm(null)
      fetchEventYearsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
      setShowDeleteConfirm(null)
    }
  }

  // Helper function to validate if event year exists in database
  const validateEventYearExists = (eventYear) => {
    if (!eventYear) {
      return { valid: false, message: 'Event year is required' }
    }
    
    // If eventYears list is empty or not loaded yet, we can't validate
    // This should not happen in normal flow, but handle it gracefully
    if (eventYears.length === 0 && loadingEventYears) {
      return { 
        valid: false, 
        message: 'Loading event years. Please wait...' 
      }
    }
    
    // Check if eventYear exists in the eventYears list
    const yearExists = eventYears.some(ey => ey.event_year === eventYear)
    if (!yearExists) {
      return { 
        valid: false, 
        message: `Event year ${year} not yet created. Please create the event year first in the "Event Years" tab.` 
      }
    }
    
    return { valid: true }
  }

  // Sport Handlers
  const handleCreateSport = async (e) => {
    e.preventDefault()
    
    // Validate event_year is required
    if (!currentEventYear) {
      onStatusPopup('❌ Please select an event year first', 'error', 3000)
      return
    }
    
    // Validate that the event year exists in the database
    const eventYearValidation = validateEventYearExists(currentEventYear)
    if (!eventYearValidation.valid) {
      onStatusPopup(`❌ ${eventYearValidation.message}`, 'error', 4000)
      return
    }
    
    // Validate team_size is required for team sports
    const isTeamSport = sportForm.type === 'dual_team' || sportForm.type === 'multi_team'
    const teamSizeStr = String(sportForm.team_size || '')
    if (isTeamSport && (!sportForm.team_size || teamSizeStr.trim() === '')) {
      onStatusPopup('❌ Team size is required for team sports (Dual Team and Multi Team)', 'error', 3000)
      return
    }
    
    try {
      const response = await fetchWithAuth(buildApiUrlWithYear('/api/sports', currentEventYear, null, currentEventName), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sportForm,
          event_year: currentEventYear, // Required - no fallback
          team_size: sportForm.team_size && String(sportForm.team_size).trim() !== '' 
            ? parseInt(sportForm.team_size, 10) 
            : null
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create sport')
      }
      clearCache(`/api/sports?event_year=${currentEventYear}`)
      clearCache(`/api/sports-counts?event_year=${currentEventYear}`)
      onStatusPopup('✅ Sport created successfully', 'success', 2500)
      setSportForm({ name: '', type: '', category: '', team_size: '', imageUri: '' })
      fetchSportsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleUpdateSport = async (e) => {
    e.preventDefault()
    if (!editingSport) return
    
    // Validate currentEventYear exists
    if (!currentEventYear) {
      onStatusPopup('❌ No event year selected. Please select an event year first.', 'error', 3000)
      return
    }
    
    // Validate sport belongs to the current event year
    if (editingSport.event_year && editingSport.event_year !== currentEventYear) {
      onStatusPopup(
        `❌ Cannot update sport. This sport belongs to event year ${editingSport.event_year}, but you are viewing event year ${currentEventYear}.`,
        'error',
        4000
      )
      return
    }
    
    // Validate team_size is required for team sports
    const isTeamSport = sportForm.type === 'dual_team' || sportForm.type === 'multi_team'
    const teamSizeStr = String(sportForm.team_size || '')
    if (isTeamSport && (!sportForm.team_size || teamSizeStr.trim() === '')) {
      onStatusPopup('❌ Team size is required for team sports (Dual Team and Multi Team)', 'error', 3000)
      return
    }
    
    try {
      const response = await fetchWithAuth(`/api/sports/${editingSport._id}?event_year=${currentEventYear}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sportForm,
          team_size: sportForm.team_size && String(sportForm.team_size).trim() !== '' 
            ? parseInt(sportForm.team_size, 10) 
            : null
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update sport')
      }
      clearCache(`/api/sports?event_year=${currentEventYear}`)
      clearCache(`/api/sports-counts?event_year=${currentEventYear}`)
      onStatusPopup('✅ Sport updated successfully', 'success', 2500)
      setEditingSport(null)
      setSportForm({ name: '', type: '', category: '', team_size: '', imageUri: '' })
      fetchSportsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleDeleteSport = async (sportId) => {
    // Validate currentEventYear exists
    if (!currentEventYear) {
      onStatusPopup('❌ No event year selected. Please select an event year first.', 'error', 3000)
      setShowDeleteSportConfirm(null)
      return
    }
    
    // Find the sport to validate it belongs to the current year
    const sportToDelete = sports.find(s => s._id === sportId)
    if (sportToDelete && sportToDelete.event_year && sportToDelete.event_year !== currentEventYear) {
      onStatusPopup(
        `❌ Cannot delete sport. This sport belongs to event year ${sportToDelete.event_year}, but you are viewing event year ${currentEventYear}.`,
        'error',
        4000
      )
      setShowDeleteSportConfirm(null)
      return
    }
    
    try {
      const response = await fetchWithAuth(`/api/sports/${sportId}?event_year=${currentEventYear}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete sport')
      }
      clearCache(`/api/sports?event_year=${currentEventYear}`)
      clearCache(`/api/sports-counts?event_year=${currentEventYear}`)
      onStatusPopup('✅ Sport deleted successfully', 'success', 2500)
      setShowDeleteSportConfirm(null)
      fetchSportsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
      setShowDeleteSportConfirm(null)
    }
  }

  const handleEditSport = (sport) => {
    setEditingSport(sport)
    setSportForm({
      name: sport.name,
      type: sport.type,
      category: sport.category,
      team_size: sport.team_size ? String(sport.team_size) : '',
      imageUri: sport.imageUri || ''
    })
  }

  // Department Handlers
  const handleCreateDepartment = async (e) => {
    e.preventDefault()
    try {
      const response = await fetchWithAuth('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...deptForm,
          display_order: parseInt(deptForm.display_order) || 0
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create department')
      }
      clearCache('/api/departments')
      onStatusPopup('✅ Department created successfully', 'success', 2500)
      setDeptForm({ name: '', code: '', display_order: 0 })
      fetchDepartmentsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleUpdateDepartment = async (e) => {
    e.preventDefault()
    if (!editingDept) return
    try {
      const response = await fetchWithAuth(`/api/departments/${editingDept._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_order: parseInt(deptForm.display_order) || 0
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update department')
      }
      clearCache('/api/departments')
      onStatusPopup('✅ Department updated successfully', 'success', 2500)
      setEditingDept(null)
      setDeptForm({ name: '', code: '', display_order: 0 })
      fetchDepartmentsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleDeleteDepartment = async (deptId) => {
    try {
      const response = await fetchWithAuth(`/api/departments/${deptId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete department')
      }
      clearCache('/api/departments')
      onStatusPopup('✅ Department deleted successfully', 'success', 2500)
      setShowDeleteDeptConfirm(null)
      fetchDepartmentsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
      setShowDeleteDeptConfirm(null)
    }
  }

  const handleEditDepartment = (dept) => {
    setEditingDept(dept)
    setDeptForm({
      name: dept.name,
      code: dept.code || '',
      display_order: dept.display_order || 0
    })
  }


  // Scroll to top when editing starts or delete confirmation is shown
  useEffect(() => {
    if (editingEventYear || editingSport || editingDept || showDeleteConfirm || showDeleteSportConfirm || showDeleteDeptConfirm) {
      // Use setTimeout to ensure DOM is updated and form/dialog is rendered
      setTimeout(() => {
        // Scroll the page window to top (for delete confirmation dialogs)
        if (showDeleteConfirm || showDeleteSportConfirm || showDeleteDeptConfirm) {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        
        // Find the modal's scrollable container (the aside element with overflow-y-auto)
        // The modal container has max-w-[900px] class and overflow-y-auto
        const modalContainer = document.querySelector('aside[class*="max-w-[900px]"]')
        if (modalContainer) {
          modalContainer.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          // Fallback: try to find any scrollable container in the modal
          const fallbackContainer = document.querySelector('.fixed.inset-0')?.querySelector('aside')
          if (fallbackContainer) {
            fallbackContainer.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }
      }, 100)
    }
  }, [editingEventYear, editingSport, editingDept, showDeleteConfirm, showDeleteSportConfirm, showDeleteDeptConfirm])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Admin Dashboard"
      maxWidth="max-w-[900px]"
    >
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[rgba(255,255,255,0.1)] overflow-x-auto">
        {Object.entries({
          [TABS.EVENT_YEARS]: 'Event Years',
          [TABS.SPORTS]: 'Sports',
          [TABS.DEPARTMENTS]: 'Departments'
        }).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 md:px-4 py-2 font-bold text-xs md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === key
                ? 'text-[#ffe66d] border-b-2 border-[#ffe66d]'
                : 'text-[#94a3b8] hover:text-[#e5e7eb]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event Years Tab */}
      {activeTab === TABS.EVENT_YEARS && (
        <div>
          {/* Create/Edit Form */}
          {!editingEventYear ? (
            <form onSubmit={handleCreateEventYear} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Create New Event Year</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Event Year"
                type="number"
                name="event_year"
                value={eventYearForm.event_year}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_year: e.target.value })}
                required
              />
              <Input
                label="Event Name"
                name="event_name"
                value={eventYearForm.event_name}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_name: e.target.value })}
                required
              />
              <Input
                label="Event Organizer"
                name="event_organizer"
                value={eventYearForm.event_organizer}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_organizer: e.target.value })}
                placeholder="Events Community"
              />
              <Input
                label="Event Title"
                name="event_title"
                value={eventYearForm.event_title}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_title: e.target.value })}
                placeholder="Community Entertainment"
              />
              <Input
                label="Event Highlight"
                name="event_highlight"
                value={eventYearForm.event_highlight}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_highlight: e.target.value })}
                placeholder="Community Entertainment Fest"
              />
              <DatePickerInput
                label="Event Start Date"
                name="event_start"
                value={eventYearForm.event_dates.start}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_dates: { ...eventYearForm.event_dates, start: e.target.value } })}
                required
              />
              <DatePickerInput
                label="Event End Date"
                name="event_end"
                value={eventYearForm.event_dates.end}
                onChange={(e) => setEventYearForm({ ...eventYearForm, event_dates: { ...eventYearForm.event_dates, end: e.target.value } })}
                required
              />
              <DatePickerInput
                label="Registration Start Date"
                name="reg_start"
                value={eventYearForm.registration_dates.start}
                onChange={(e) => setEventYearForm({ ...eventYearForm, registration_dates: { ...eventYearForm.registration_dates, start: e.target.value } })}
                required
              />
              <DatePickerInput
                label="Registration End Date"
                name="reg_end"
                value={eventYearForm.registration_dates.end}
                onChange={(e) => setEventYearForm({ ...eventYearForm, registration_dates: { ...eventYearForm.registration_dates, end: e.target.value } })}
                required
              />
            </div>
            <Button type="submit" className="mt-4">Create</Button>
          </form>
          ) : (
            <form onSubmit={handleUpdateEventYear} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Edit Event Year: {editingEventYear.event_year}</h4>
              {(() => {
                const updatableFields = getUpdatableDateFields(editingEventYear)
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <Input
                        label="Event Year"
                        type="number"
                        name="event_year"
                        value={eventYearForm.event_year}
                        disabled
                        className="opacity-50"
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateNonDateFields ? updatableFields.nonDateFieldsTooltip : ''}>
                      <Input
                        label="Event Name"
                        name="event_name"
                        value={eventYearForm.event_name}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, event_name: e.target.value })}
                        required
                        disabled={!updatableFields.canUpdateNonDateFields}
                        className={!updatableFields.canUpdateNonDateFields ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateNonDateFields ? updatableFields.nonDateFieldsTooltip : ''}>
                      <Input
                        label="Event Organizer"
                        name="event_organizer"
                        value={eventYearForm.event_organizer}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, event_organizer: e.target.value })}
                        placeholder="Events Community"
                        disabled={!updatableFields.canUpdateNonDateFields}
                        className={!updatableFields.canUpdateNonDateFields ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateNonDateFields ? updatableFields.nonDateFieldsTooltip : ''}>
                      <Input
                        label="Event Title"
                        name="event_title"
                        value={eventYearForm.event_title}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, event_title: e.target.value })}
                        placeholder="Community Entertainment"
                        disabled={!updatableFields.canUpdateNonDateFields}
                        className={!updatableFields.canUpdateNonDateFields ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateNonDateFields ? updatableFields.nonDateFieldsTooltip : ''}>
                      <Input
                        label="Event Highlight"
                        name="event_highlight"
                        value={eventYearForm.event_highlight}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, event_highlight: e.target.value })}
                        placeholder="Community Entertainment Fest"
                        disabled={!updatableFields.canUpdateNonDateFields}
                        className={!updatableFields.canUpdateNonDateFields ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateEventStart ? updatableFields.eventStartTooltip : ''}>
                      <DatePickerInput
                        label="Event Start Date"
                        name="event_start"
                        value={eventYearForm.event_dates.start}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, event_dates: { ...eventYearForm.event_dates, start: e.target.value } })}
                        required
                        disabled={!updatableFields.canUpdateEventStart}
                        className={!updatableFields.canUpdateEventStart ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateEventEnd ? updatableFields.eventEndTooltip : ''}>
                      <DatePickerInput
                        label="Event End Date"
                        name="event_end"
                        value={eventYearForm.event_dates.end}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, event_dates: { ...eventYearForm.event_dates, end: e.target.value } })}
                        required
                        disabled={!updatableFields.canUpdateEventEnd}
                        className={!updatableFields.canUpdateEventEnd ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateRegStart ? updatableFields.regStartTooltip : ''}>
                      <DatePickerInput
                        label="Registration Start Date"
                        name="reg_start"
                        value={eventYearForm.registration_dates.start}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, registration_dates: { ...eventYearForm.registration_dates, start: e.target.value } })}
                        required
                        disabled={!updatableFields.canUpdateRegStart}
                        className={!updatableFields.canUpdateRegStart ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="relative" title={!updatableFields.canUpdateRegEnd ? updatableFields.regEndTooltip : ''}>
                      <DatePickerInput
                        label="Registration End Date"
                        name="reg_end"
                        value={eventYearForm.registration_dates.end}
                        onChange={(e) => setEventYearForm({ ...eventYearForm, registration_dates: { ...eventYearForm.registration_dates, end: e.target.value } })}
                        required
                        disabled={!updatableFields.canUpdateRegEnd}
                        className={!updatableFields.canUpdateRegEnd ? 'opacity-50 cursor-not-allowed' : ''}
                      />
                    </div>
                  </div>
                )
              })()}
              <div className="flex gap-2 mt-4">
                <Button type="submit">Update</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingEventYear(null)
                    setEventYearForm({ event_year: '', event_name: '', event_organizer: '', event_title: '', event_highlight: '', event_dates: { start: '', end: '' }, registration_dates: { start: '', end: '' } })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* List */}
          <div>
            <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Existing Event Years</h4>
            {loadingEventYears ? (
              <LoadingSpinner />
            ) : eventYears.length === 0 ? (
              <p className="text-[#94a3b8]">No event years found</p>
            ) : (
              <div className="space-y-2">
                {eventYears.map((eventYear) => (
                  <div key={eventYear._id || eventYear.event_year} className="p-3 bg-[rgba(0,0,0,0.3)] rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-row items-center justify-start gap-2">
                      <div>
                        <span className="font-bold text-[#ffe66d]">{eventYear.event_year}</span>
                        <span className="ml-2 text-[#e5e7eb]">- {eventYear.event_name}</span>
                        {eventYear.is_active && (
                          <span className="ml-2 px-2 py-1 bg-[#22c55e] text-white text-xs rounded">Active</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 md:ml-0">
                      <Button
                        variant="secondary"
                        onClick={() => handleEditEventYear(eventYear)}
                        className="px-3 py-1 text-xs"
                        disabled={!!editingEventYear}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setShowDeleteConfirm(eventYear.event_year)}
                        className="px-3 py-1 text-xs"
                        disabled={!!editingEventYear || eventYear.is_active}
                        title={eventYear.is_active ? 'Cannot delete the active event year. The event is currently active based on its registration and event dates.' : ''}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sports Tab */}
      {activeTab === TABS.SPORTS && (
        <div>
          {loggedInUser && (
            <div className="flex items-center justify-end mb-4">
              <EventYearSelector
                selectedEventYear={selectedEventYear}
                onEventYearChange={onEventYearChange}
                loggedInUser={loggedInUser}
              />
            </div>
          )}
          {!currentEventYear && (
            <ErrorMessage message="No active event year. Please select an event year from the dropdown above or wait for an event year's registration period to begin." />
          )}
          
          {/* Create/Edit Form */}
          <form onSubmit={editingSport ? handleUpdateSport : handleCreateSport} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
            <h4 className="text-md font-bold text-[#cbd5ff] mb-3">
              {editingSport ? 'Edit Sport' : 'Create New Sport'}
              {!currentEventYear && !editingSport && (
                <span className="ml-2 text-red-400 text-sm">(Event year required)</span>
              )}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Sport Name"
                name="name"
                value={sportForm.name}
                onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })}
                required
                disabled={!!editingSport}
              />
              <Input
                label="Type"
                type="select"
                name="type"
                value={sportForm.type}
                onChange={(e) => setSportForm({ ...sportForm, type: e.target.value })}
                options={[
                  { value: 'dual_team', label: 'Dual Team' },
                  { value: 'multi_team', label: 'Multi Team' },
                  { value: 'dual_player', label: 'Dual Player' },
                  { value: 'multi_player', label: 'Multi Player' }
                ]}
                required
              />
              <Input
                label="Category"
                type="select"
                name="category"
                value={sportForm.category}
                onChange={(e) => setSportForm({ ...sportForm, category: e.target.value })}
                options={[
                  { value: 'team events', label: 'Team Events' },
                  { value: 'individual events', label: 'Individual Events' },
                  { value: 'literary and cultural activities', label: 'Literary and Cultural Activities' }
                ]}
                required
              />
                <Input
                  label="Team Size"
                type="select"
                  name="team_size"
                value={sportForm.team_size || ''}
                onChange={(e) => setSportForm({ ...sportForm, team_size: e.target.value || '' })}
                options={[
                  ...(sportForm.type === 'dual_team' || sportForm.type === 'multi_team' 
                    ? []
                    : [{ value: '', label: 'Optional (No limit)' }]
                  ),
                  { value: '2', label: '2 players' },
                  { value: '3', label: '3 players' },
                  { value: '4', label: '4 players' },
                  { value: '5', label: '5 players' },
                  { value: '6', label: '6 players' },
                  { value: '7', label: '7 players' },
                  { value: '8', label: '8 players' },
                  { value: '9', label: '9 players' },
                  { value: '10', label: '10 players' },
                  { value: '11', label: '11 players' },
                  { value: '12', label: '12 players' },
                  { value: '15', label: '15 players' },
                  { value: '20', label: '20 players' }
                ]}
                disabled={!(sportForm.type === 'dual_team' || sportForm.type === 'multi_team')}
                required={sportForm.type === 'dual_team' || sportForm.type === 'multi_team'}
                />
              <Input
                label="Image URI"
                name="imageUri"
                value={sportForm.imageUri}
                onChange={(e) => setSportForm({ ...sportForm, imageUri: e.target.value })}
                placeholder="/images/sport.jpg"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                type="submit" 
                disabled={
                  (!editingSport && !currentEventYear) ||
                  ((sportForm.type === 'dual_team' || sportForm.type === 'multi_team') && 
                   (!sportForm.team_size || String(sportForm.team_size || '').trim() === ''))
                }
              >
                {editingSport ? 'Update' : 'Create'}
              </Button>
              {editingSport && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingSport(null)
                    setSportForm({ name: '', type: '', category: '', team_size: '', imageUri: '' })
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {/* List */}
          <div>
            <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Existing Sports</h4>
            {loadingSports ? (
              <LoadingSpinner />
            ) : sports.length === 0 ? (
              <p className="text-[#94a3b8]">No sports found for current event year</p>
            ) : (
              <div className="space-y-2">
                {sports.map((sport) => (
                  <div key={sport._id || sport.name} className="p-3 bg-[rgba(0,0,0,0.3)] rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <span className="font-bold text-[#ffe66d]">{formatSportName(sport.name)}</span>
                      <span className="ml-2 text-[#94a3b8] text-sm">
                        ({sport.type} - {sport.category})
                      </span>
                      {sport.team_size && (
                        <span className="ml-2 text-[#cbd5ff] text-sm">Team Size: {sport.team_size}</span>
                      )}
                    </div>
                    <div className="flex gap-2 md:ml-0">
                      <Button
                        variant="secondary"
                        onClick={() => handleEditSport(sport)}
                        className="px-3 py-1 text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setShowDeleteSportConfirm(sport._id)}
                        className="px-3 py-1 text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === TABS.DEPARTMENTS && (
        <div>
          {/* Create Form */}
          {!editingDept && (
            <form onSubmit={handleCreateDepartment} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Create New Department</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Department Name"
                  name="name"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  required
                />
                <Input
                  label="Code (Optional)"
                  name="code"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                />
                <Input
                  label="Display Order"
                  type="number"
                  name="display_order"
                  value={deptForm.display_order}
                  onChange={(e) => setDeptForm({ ...deptForm, display_order: e.target.value })}
                />
              </div>
              <Button type="submit" className="mt-4">Create</Button>
            </form>
          )}

          {/* Edit Form */}
          {editingDept && (
            <form onSubmit={handleUpdateDepartment} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Edit Department: {editingDept.name}</h4>
                <Input
                  label="Display Order"
                  type="number"
                  name="display_order"
                  value={deptForm.display_order}
                  onChange={(e) => setDeptForm({ ...deptForm, display_order: e.target.value })}
                />
              <div className="flex gap-2 mt-4">
                <Button type="submit">Update</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingDept(null)
                    setDeptForm({ name: '', code: '', display_order: 0 })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* List */}
          <div>
            <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Existing Departments</h4>
            {loadingDepts ? (
              <LoadingSpinner />
            ) : departments.length === 0 ? (
              <p className="text-[#94a3b8]">No departments found</p>
            ) : (
              <div className="space-y-2">
                {departments.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map((dept) => (
                  <div key={dept._id || dept.name} className="p-3 bg-[rgba(0,0,0,0.3)] rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <span className="font-bold text-[#ffe66d]">{dept.name}</span>
                      {dept.code && <span className="ml-2 text-[#94a3b8]">({dept.code})</span>}
                      <span className="ml-2 text-[#94a3b8] text-sm">Order: {dept.display_order || 0}</span>
                    </div>
                    <div className="flex gap-2 md:ml-0">
                      <Button
                        variant="secondary"
                        onClick={() => handleEditDepartment(dept)}
                        className="px-3 py-1 text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setShowDeleteDeptConfirm(dept._id)}
                        className="px-3 py-1 text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      {showDeleteConfirm && (
        <ConfirmationDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={() => handleDeleteEventYear(showDeleteConfirm)}
          title="Delete Event Year"
          message={`Are you sure you want to delete event year ${showDeleteConfirm}? This action cannot be undone.`}
        />
      )}

      {showDeleteSportConfirm && (
        <ConfirmationDialog
          isOpen={!!showDeleteSportConfirm}
          onClose={() => setShowDeleteSportConfirm(null)}
          onConfirm={() => handleDeleteSport(showDeleteSportConfirm)}
          title="Delete Sport"
          message="Are you sure you want to delete this sport? This action cannot be undone if there are matches or points associated with it."
        />
      )}

      {showDeleteDeptConfirm && (
        <ConfirmationDialog
          isOpen={!!showDeleteDeptConfirm}
          onClose={() => setShowDeleteDeptConfirm(null)}
          onConfirm={() => handleDeleteDepartment(showDeleteDeptConfirm)}
          title="Delete Department"
          message="Are you sure you want to delete this department? This action cannot be undone if there are players registered with this department."
        />
      )}
    </Modal>
  )
}

export default AdminDashboardModal

