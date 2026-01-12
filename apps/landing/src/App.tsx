import { motion } from 'framer-motion';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="content">
        {/* Main Harbor title */}
        <motion.h1
          className="main-title"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          HARBOR
        </motion.h1>

        {/* Tagline */}
        <motion.div
          className="tagline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          where knowledge work is traded like cargo
        </motion.div>

        {/* CTA Button */}
        <motion.a
          href="#"
          className="cta-button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Schedule a Call
        </motion.a>
      </div>
    </div>
  );
}

export default App;
