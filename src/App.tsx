import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RequirementPortalPage from '@/pages/RequirementPortalPage';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="*" element={<RequirementPortalPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
