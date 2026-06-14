import { Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './Home';
import { Screen } from './screen/Screen';
import { Controller } from './controller/Controller';
import { Toasts } from './components/Toasts';

export default function App() {
  return (
    <>
      <div className="aurora">
        <div className="blob3" />
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/screen" element={<Screen />} />
        <Route path="/j" element={<Controller />} />
        <Route path="/j/:code" element={<Controller />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  );
}
