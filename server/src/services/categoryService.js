// Shared category service for managing categories across the application
let categories = [
  { id: '1', name: 'Academic', count: 0, description: 'Educational and academic emails' },
  { id: '2', name: 'Promotions', count: 0, description: 'Marketing and promotional emails' },
  { id: '3', name: 'Placement', count: 0, description: 'Job and career related emails' },
  { id: '4', name: 'Spam', count: 0, description: 'Spam and unwanted emails' },
  { id: '5', name: 'Other', count: 0, description: 'Miscellaneous emails' }
]

export const getCategories = () => {
  return [...categories]
}

export const getCategoryCount = () => {
  return categories.length
}

export const addCategory = (category) => {
  const newCategory = {
    id: Date.now().toString(),
    name: category.name.trim(),
    description: category.description || `Custom category: ${category.name.trim()}`,
    count: 0,
    createdAt: new Date().toISOString()
  }
  categories.push(newCategory)
  return newCategory
}

export const updateCategory = (id, updates) => {
  const categoryIndex = categories.findIndex(cat => cat.id === id)
  if (categoryIndex === -1) return null
  
  const updatedCategory = {
    ...categories[categoryIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  categories[categoryIndex] = updatedCategory
  return updatedCategory
}

export const deleteCategory = (id) => {
  const categoryIndex = categories.findIndex(cat => cat.id === id)
  if (categoryIndex === -1) return null
  
  const deletedCategory = categories[categoryIndex]
  categories.splice(categoryIndex, 1)
  return deletedCategory
}

export const findCategoryById = (id) => {
  return categories.find(cat => cat.id === id)
}

export const findCategoryByName = (name) => {
  if (!name) return null
  
  const searchName = name.toLowerCase().trim()
  return categories.find(cat => cat.name.toLowerCase().trim() === searchName)
}
