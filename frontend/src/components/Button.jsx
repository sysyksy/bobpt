const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = ''
}) => {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-all'

  const variants = {
    primary: 'bg-neon-blue text-dark-bg hover:shadow-neon disabled:opacity-50',
    secondary: 'bg-dark-secondary border border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-dark-bg disabled:opacity-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export default Button
