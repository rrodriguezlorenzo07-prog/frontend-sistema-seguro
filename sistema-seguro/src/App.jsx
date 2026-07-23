import LoginForm from './components/LoginForm';

export default function App() {
    return (
        // Le quitamos el fondo oscuro y lo dejamos preparado
        <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
            <LoginForm />
        </div>
    );
}