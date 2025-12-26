function Navbar() {
  return (
    <nav className="bg-[rgba(5,7,22,0.96)] backdrop-blur-[20px] py-[0.9rem] sticky top-0 z-[100] shadow-[0_10px_25px_rgba(0,0,0,0.6)]">
      <div className="max-w-[1300px] mx-auto px-4 flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-[0.6rem]">
          <img src="/images/logo.png" alt="PCE Logo" className="h-10 w-auto object-contain" />
          <div className="text-[1.1rem] font-extrabold tracking-[0.16em] uppercase text-white">
            <span className="text-[#ffe66d]">PCE - Annual Sports</span> - 2026
          </div>
        </div>

        <ul className="flex items-center gap-[1.6rem] list-none text-[0.85rem] uppercase tracking-[0.08em] max-md:w-full max-md:justify-center max-md:mt-1 max-md:gap-[1.2rem] max-md:text-[0.78rem]">
          <li>
            <a href="#home" className="text-[#e2e8f0] no-underline relative pb-[3px] hover:text-[#ffe66d] after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#ffe66d] after:to-[#ff4d4d] after:transition-all after:duration-[0.25s] after:ease-in-out hover:after:w-full">
              Home
            </a>
          </li>
          <li>
            <a href="#about" className="text-[#e2e8f0] no-underline relative pb-[3px] hover:text-[#ffe66d] after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#ffe66d] after:to-[#ff4d4d] after:transition-all after:duration-[0.25s] after:ease-in-out hover:after:w-full">
              About
            </a>
          </li>
          <li>
            <a href="#contact" className="text-[#e2e8f0] no-underline relative pb-[3px] hover:text-[#ffe66d] after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#ffe66d] after:to-[#ff4d4d] after:transition-all after:duration-[0.25s] after:ease-in-out hover:after:w-full">
              Contact
            </a>
          </li>
          <li>
            <div className="flex items-center bg-[#e5e7eb]">
              <img src="/images/State.png" alt="State Logo" className="h-10 w-auto object-contain" />
            </div>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navbar

