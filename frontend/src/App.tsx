import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Datasets from './pages/Datasets';
import DatasetDetail from './pages/DatasetDetail';
import Training from './pages/Training';
import TrainingNew from './pages/TrainingNew';
import TrainingDetail from './pages/TrainingDetail';
import Models from './pages/Models';
import Analysis from './pages/Analysis';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="datasets/:id" element={<DatasetDetail />} />
          <Route path="training" element={<Training />} />
          <Route path="training/new" element={<TrainingNew />} />
          <Route path="training/:id" element={<TrainingDetail />} />
          <Route path="models" element={<Models />} />
          <Route path="analysis" element={<Analysis />} />
          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
