import React from 'react';
import './TabbedNavigation.css';
import Button from './ui/Button';

export interface Tab {
  key: string;
  label: string;
  icon: string;
  count?: number;
}

interface TabbedNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  className?: string;
}

const TabbedNavigation: React.FC<TabbedNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = ''
}) => {
  return (
    <div className={`card tabbed-navigation ${className}`}>
      <div className="tabbed-navigation__container">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`tabbed-navigation__tab ${
              activeTab === tab.key ? 'tabbed-navigation__tab--active' : ''
            }`}
          >
            <span className="tabbed-navigation__icon">{tab.icon}</span>
            <span className="tabbed-navigation__label">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`tabbed-navigation__count ${
                activeTab === tab.key ? 'tabbed-navigation__count--active' : ''
              }`}>
                {tab.count}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default TabbedNavigation;
