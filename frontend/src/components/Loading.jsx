const Loading = ({ text = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="w-12 h-12 border-4 border-dark-border border-t-neon-blue rounded-full animate-spin mb-4"></div>
      <p className="text-gray-400">{text}</p>
    </div>
  )
}

export default Loading
