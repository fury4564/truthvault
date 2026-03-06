export default function Modal({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
        }}>
            <div className="modal">
                {children}
            </div>
        </div>
    );
}
