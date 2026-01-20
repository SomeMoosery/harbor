import { motion } from 'framer-motion';
import './App.css';

function App() {
  return (
    <div className="app">
      {/* Main Harbor title - fixed to top */}
      <motion.h1
        className="main-title"
        initial={{ opacity: 0, y: -20, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ duration: 0.2 }}
      >
        HARBOR
      </motion.h1>

      {/* CTA Button - fixed to bottom */}
      <motion.a
        href="https://calendar.app.google/wQJ3Eef44TWSvSek8"
        target="_blank"
        rel="noopener noreferrer"
        className="cta-button"
        initial={{ opacity: 0, y: 20, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        Join the beta
      </motion.a>
    </div>
  );
}

export default App;
