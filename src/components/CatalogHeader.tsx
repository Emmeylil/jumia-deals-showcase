const CatalogHeader = () => {
  return (
    <header className="gradient-header w-full py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-primary-foreground">
          JUMIA
        </h1>
        <span className="w-3 h-3 rounded-full bg-jumia-orange inline-block" />
        <p className="text-primary-foreground/80 text-sm md:text-base font-semibold hidden sm:block">
          Top Deals — Save Big Today!
        </p>
      </div>
    </header>
  );
};

export default CatalogHeader;
