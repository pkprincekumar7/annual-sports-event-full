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
import YearSelector from './YearSelector'

const TABS = {
  EVENT_YEARS: 'event_years',
  SPORTS: 'sports',
  DEPARTMENTS: 'departments'
}

function AdminDashboardModal({ isOpen, onClose, onStatusPopup, selectedYear, onYearChange, loggedInUser }) {
  const [activeTab, setActiveTab] = useState(TABS.EVENT_YEARS)
  const { eventYear: activeEventYear } = useEventYear()
  // Use selectedYear if admin selected one, otherwise use active year
  const currentEventYear = selectedYear || activeEventYear

  // Event Years State
  const [eventYears, setEventYears] = useState([])
  const [eventYearForm, setEventYearForm] = useState({
    year: '',
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

  // Fetch data when tab changes or selectedYear changes
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
      const years = data.eventYears || (Array.isArray(data) ? data : [])
      // Always update with fresh data from server (this will include the newly created year)
      setEventYears(Array.isArray(years) ? years.sort((a, b) => b.year - a.year) : [])
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
      const response = await fetchWithAuth(`/api/sports${currentEventYear ? `?year=${currentEventYear}` : ''}`)
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
    try {
      const response = await fetchWithAuth('/api/event-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: eventYearForm.year,
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
      onStatusPopup('✅ Event year created successfully', 'success', 2500)
      setEventYearForm({ year: '', event_name: '', event_organizer: '', event_title: '', event_highlight: '', event_dates: { start: '', end: '' }, registration_dates: { start: '', end: '' } })
      // Add the newly created year to the list immediately (optimistic update)
      setEventYears(prev => {
        // Check if year already exists to avoid duplicates
        const exists = prev.some(y => y._id === createdYear._id || y.year === createdYear.year)
        if (exists) {
          return prev.map(y => y._id === createdYear._id || y.year === createdYear.year ? createdYear : y).sort((a, b) => b.year - a.year)
        }
        return [createdYear, ...prev].sort((a, b) => b.year - a.year)
      })
      // Refetch after a short delay to ensure consistency with server
      setTimeout(() => {
        fetchEventYearsData()
      }, 300)
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleActivateEventYear = async (year) => {
    try {
      const response = await fetchWithAuth(`/api/event-years/${year}/activate`, {
        method: 'PUT'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to activate event year')
      }
      clearCache('/api/event-years/active')
      onStatusPopup('✅ Event year activated successfully', 'success', 2500)
      fetchEventYearsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleUpdateEventYear = async (e) => {
    e.preventDefault()
    if (!editingEventYear) return
    try {
      const updateData = {
        event_name: eventYearForm.event_name,
        event_dates: {
          start: new Date(eventYearForm.event_dates.start + 'T00:00:00'),
          end: new Date(eventYearForm.event_dates.end + 'T23:59:59')
        },
        registration_dates: {
          start: new Date(eventYearForm.registration_dates.start + 'T00:00:00'),
          end: new Date(eventYearForm.registration_dates.end + 'T23:59:59')
        },
        // Always include optional fields - backend will handle defaults if empty
        event_organizer: eventYearForm.event_organizer ? eventYearForm.event_organizer.trim() : '',
        event_title: eventYearForm.event_title ? eventYearForm.event_title.trim() : '',
        event_highlight: eventYearForm.event_highlight ? eventYearForm.event_highlight.trim() : ''
      }
      
      const response = await fetchWithAuth(`/api/event-years/${editingEventYear.year}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update event year')
      }
      clearCache('/api/event-years/active')
      onStatusPopup('✅ Event year updated successfully', 'success', 2500)
      setEditingEventYear(null)
      setEventYearForm({ year: '', event_name: '', event_organizer: '', event_title: '', event_highlight: '', event_dates: { start: '', end: '' }, registration_dates: { start: '', end: '' } })
      fetchEventYearsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleEditEventYear = (year) => {
    setEditingEventYear(year)
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
      year: year.year.toString(),
      event_name: year.event_name,
      event_organizer: year.event_organizer || '',
      event_title: year.event_title || '',
      event_highlight: year.event_highlight || '',
      event_dates: {
        start: formatDateForInput(year.event_dates.start),
        end: formatDateForInput(year.event_dates.end)
      },
      registration_dates: {
        start: formatDateForInput(year.registration_dates.start),
        end: formatDateForInput(year.registration_dates.end)
      }
    })
  }

  const handleDeleteEventYear = async (year) => {
    try {
      const response = await fetchWithAuth(`/api/event-years/${year}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete event year')
      }
      clearCache('/api/event-years/active')
      onStatusPopup('✅ Event year deleted successfully', 'success', 2500)
      setShowDeleteConfirm(null)
      fetchEventYearsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
      setShowDeleteConfirm(null)
    }
  }

  // Helper function to validate if event year exists in database
  const validateEventYearExists = (year) => {
    if (!year) {
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
    
    // Check if year exists in the eventYears list
    const yearExists = eventYears.some(ey => ey.year === year)
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
    const yearValidation = validateEventYearExists(currentEventYear)
    if (!yearValidation.valid) {
      onStatusPopup(`❌ ${yearValidation.message}`, 'error', 4000)
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
      const response = await fetchWithAuth(buildApiUrlWithYear('/api/sports', currentEventYear), {
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
      clearCache(`/api/sports?year=${currentEventYear}`)
      clearCache(`/api/sports-counts?year=${currentEventYear}`)
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
    
    // Validate team_size is required for team sports
    const isTeamSport = sportForm.type === 'dual_team' || sportForm.type === 'multi_team'
    const teamSizeStr = String(sportForm.team_size || '')
    if (isTeamSport && (!sportForm.team_size || teamSizeStr.trim() === '')) {
      onStatusPopup('❌ Team size is required for team sports (Dual Team and Multi Team)', 'error', 3000)
      return
    }
    
    try {
      const response = await fetchWithAuth(`/api/sports/${editingSport._id}`, {
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
      clearCache(`/api/sports?year=${currentEventYear}`)
      clearCache(`/api/sports-counts?year=${currentEventYear}`)
      onStatusPopup('✅ Sport updated successfully', 'success', 2500)
      setEditingSport(null)
      setSportForm({ name: '', type: '', category: '', team_size: '', imageUri: '' })
      fetchSportsData()
    } catch (error) {
      onStatusPopup(`❌ ${error.message}`, 'error', 3000)
    }
  }

  const handleDeleteSport = async (sportId) => {
    try {
      const response = await fetchWithAuth(`/api/sports/${sportId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete sport')
      }
      clearCache(`/api/sports?year=${currentEventYear}`)
      clearCache(`/api/sports-counts?year=${currentEventYear}`)
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
      clearCache('/api/departments/active')
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
      clearCache('/api/departments/active')
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
      clearCache('/api/departments/active')
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
      <div className="flex gap-2 mb-6 border-b border-[rgba(255,255,255,0.1)]">
        {Object.entries({
          [TABS.EVENT_YEARS]: 'Event Years',
          [TABS.SPORTS]: 'Sports',
          [TABS.DEPARTMENTS]: 'Departments'
        }).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 font-bold text-sm uppercase tracking-wide transition-colors ${
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
          <h3 className="text-lg font-bold text-[#ffe66d] mb-4">Manage Event Years</h3>
          
          {/* Create/Edit Form */}
          {!editingEventYear ? (
            <form onSubmit={handleCreateEventYear} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Create New Event Year</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Year"
                type="number"
                name="year"
                value={eventYearForm.year}
                onChange={(e) => setEventYearForm({ ...eventYearForm, year: e.target.value })}
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
            <Button type="submit" className="mt-4">Create Event Year</Button>
          </form>
          ) : (
            <form onSubmit={handleUpdateEventYear} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Edit Event Year: {editingEventYear.year}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Year"
                    type="number"
                    name="year"
                    value={eventYearForm.year}
                    disabled
                    className="opacity-50"
                  />
                </div>
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
              <div className="flex gap-2 mt-4">
                <Button type="submit">Update Event Year</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingEventYear(null)
                    setEventYearForm({ year: '', event_name: '', event_organizer: '', event_title: '', event_highlight: '', event_dates: { start: '', end: '' }, registration_dates: { start: '', end: '' } })
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
                {eventYears.map((year) => (
                  <div key={year._id} className="p-3 bg-[rgba(0,0,0,0.3)] rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#ffe66d]">{year.year}</span>
                      <span className="ml-2 text-[#e5e7eb]">- {year.event_name}</span>
                      {year.is_active && (
                        <span className="ml-2 px-2 py-1 bg-[#22c55e] text-white text-xs rounded">Active</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!year.is_active && (
                        <Button
                          variant="success"
                          onClick={() => handleActivateEventYear(year.year)}
                          className="px-3 py-1 text-xs"
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => handleEditEventYear(year)}
                        className="px-3 py-1 text-xs"
                        disabled={!!editingEventYear}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setShowDeleteConfirm(year.year)}
                        className="px-3 py-1 text-xs"
                        disabled={!!editingEventYear || year.is_active}
                        title={year.is_active ? 'Cannot delete the active event year. Please activate another event year first.' : ''}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#ffe66d]">Manage Sports</h3>
            {loggedInUser && (
              <YearSelector
                selectedYear={selectedYear}
                onYearChange={onYearChange}
                loggedInUser={loggedInUser}
              />
            )}
          </div>
          {!currentEventYear && (
            <ErrorMessage message="No active event year. Please activate an event year first or select a year from the dropdown above." />
          )}
          
          {/* Create/Edit Form */}
          <form onSubmit={editingSport ? handleUpdateSport : handleCreateSport} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
            <h4 className="text-md font-bold text-[#cbd5ff] mb-3">
              {editingSport ? 'Edit Sport' : 'Create New Sport'}
              {!currentEventYear && !editingSport && (
                <span className="ml-2 text-red-400 text-sm">(Event year required)</span>
              )}
            </h4>
            <div className="grid grid-cols-2 gap-4">
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
                {editingSport ? 'Update' : 'Create'} Sport
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
                  <div key={sport._id} className="p-3 bg-[rgba(0,0,0,0.3)] rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#ffe66d]">{formatSportName(sport.name)}</span>
                      <span className="ml-2 text-[#94a3b8] text-sm">
                        ({sport.type} - {sport.category})
                      </span>
                      {sport.team_size && (
                        <span className="ml-2 text-[#cbd5ff] text-sm">Team Size: {sport.team_size}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
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
          <h3 className="text-lg font-bold text-[#ffe66d] mb-4">Manage Departments</h3>
          
          {/* Create Form */}
          {!editingDept && (
            <form onSubmit={handleCreateDepartment} className="mb-6 p-4 bg-[rgba(0,0,0,0.3)] rounded-lg">
              <h4 className="text-md font-bold text-[#cbd5ff] mb-3">Create New Department</h4>
              <div className="grid grid-cols-3 gap-4">
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
              <Button type="submit" className="mt-4">Create Department</Button>
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
                <Button type="submit">Update Department</Button>
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
                  <div key={dept._id} className="p-3 bg-[rgba(0,0,0,0.3)] rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#ffe66d]">{dept.name}</span>
                      {dept.code && <span className="ml-2 text-[#94a3b8]">({dept.code})</span>}
                      <span className="ml-2 text-[#94a3b8] text-sm">Order: {dept.display_order || 0}</span>
                    </div>
                    <div className="flex gap-2">
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

