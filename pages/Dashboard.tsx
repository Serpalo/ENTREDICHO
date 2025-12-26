import React from 'react';

const Dashboard = () => {
  return (
    <div style={{ padding: '100px', textAlign: 'center', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '50px', color: 'red' }}>PRUEBA DE VIDA: SI VES ESTO, EL CODIGO FUNCIONA</h1>
      <p style={{ fontSize: '20px' }}>Si ves este mensaje, el fallo está en la conexión con Supabase.</p>
    </div>
  );
};

export default Dashboard;
