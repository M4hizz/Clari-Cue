import "./LargeButton.css";

function LargeButton({ children, onClick, variant = "primary" }) {
  return (
    <button
      className={`large-button large-button--${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default LargeButton;
