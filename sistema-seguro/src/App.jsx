import LoginForm from './components/LoginForm';



export default function App() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif' }}>
            <h1 style={{ marginBottom: '20px' }}>Portal de Seguridad</h1>
            <LoginForm />
        </div>
    );
}