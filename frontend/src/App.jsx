import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Editor from './pages/Editor'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:videoId" element={<Editor />} />
      </Routes>
    </Router>
  )
}

export default App
