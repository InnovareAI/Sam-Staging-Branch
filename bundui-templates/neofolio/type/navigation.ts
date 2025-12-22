export type NavLink = {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  target?: "_blank" | "_self" | "_parent" | "_top";
};

export type NavGroup = {
  title: string;
  url: string;
  items: NavLink[];
};
