import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'

interface LayoutProps {
  children: React.ReactNode
}

function Layout({ children }: LayoutProps) {
  const { setActiveProject, projects } = useProjectStore()

  useEffect(() => {
    // Set up keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+1-9 to switch projects
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (projects[index]) {
          setActiveProject(projects[index].id)
        }
      }
      
      // Cmd+K to focus command bar
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        const commandInput = document.querySelector('[data-command-input]') as HTMLInputElement
        commandInput?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projects, setActiveProject])

  return <>{children}</>
}

export default Layout