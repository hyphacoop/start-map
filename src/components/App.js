import React from 'react';
import ReactGA from 'react-ga';
import sort from 'fast-sort';
import runtimeEnv from '@mars/heroku-js-runtime-env';

import BetaBanner from "./BetaBanner";
import Splash from "./Splash";
import FeatureDetail from "./FeatureDetail";
import FeatureList from "./FeatureList";
import InteractiveMap from "./InteractiveMap";
import MobileMapPopup from "./MobileMapPopup";
import Header from "./Header";
import Logo from "./Logo";
import Filters from "./Filters";

import {
  BackToListViewButton,
  GeolocateButton,
} from "./Buttons";

import * as constants from "../constants";

import 'bootstrap/dist/css/bootstrap.min.css'; // Must come first.
import 'simplebar/dist/simplebar.css';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import '../assets/scss/App.scss';

const env = runtimeEnv()


export default class App extends React.Component {

  state = {
    /** Array of visible feature points in maps and lists. (visibleFeatures) */
    visFtrs: [],
    /** The type of view.
     * Options: list, detail, map, filter
     * Last two only display differently on mobile. */
    viewType: "map",
    /** Full object representing active artwork. */
    activeFeature: {},
    /** Keep track of whether any filters are applied. */
    isFiltered: false,
    /** Array of year OptionTypes to filter features by. */
    years: constants.YEAR_OPTS,
    /** Array of ward OptionTypes to filter features by. */
    wards: constants.WARD_OPTS,
    /** Array of program OptionTypes to filter features by. */
    programs: constants.PROGRAM_OPTS,
    /** Whether the view is mobile based on screen width. */
    isMobileView: window.innerWidth <= 1024,
    /** Boolean controlling whether to show ward layer on map. */
    showWardLayer: false,
    /** Boolean controlling whether to show splash popup. */
    showSplash: false,
    /** Integer controlling which sort method for all feature lists. */
    sortType: 'artist-asc',
  }

  initReactGA = () => {
    ReactGA.initialize(env.REACT_APP_GOOGLE_ANALYTICS_ID);
    ReactGA.pageview(window.location.pathname + window.location.search);
  }

  componentDidMount(){
    this.initReactGA();
    this.fetchFeatures();
    window.addEventListener("resize", this.resize.bind(this));
  }

  fetchFeatures() {
    const isArtwork = (feature) => (
      feature.geometry &&
      feature.geometry.type === 'Point'
    )

    fetch('geojson/ftrs.json')
      .then(response => response.json())
      .then(json => {
        const visFtrs = json.features.map(f => {
          if (!isArtwork(f)) return null
          return f.properties
        }).filter(Boolean)
        this.setState({ visFtrs },
          // Sort after first load.
          () => { this.sortList() }
        );
      });
  }

  resize() {
    this.setState({
      isMobileView: window.innerWidth <= 1024
    });
    if (this.state.isMobileView) {
      this.refs.mapControl.prepareMapMobile();
    } else {
      this.refs.mapControl.prepareMapDesktop();
    }
  }

  closeSplash = () => {
    this.setState({
      showSplash: false
    })
  }

  showMobileDetail = () =>{
    this.setState({
      viewType: "detail",
    });
  }

  setVisibleFeatures = (visFtrs) => {
    this.setState(
      {visFtrs: visFtrs},
      () => { this.sortList() }
    );
  }

  triggerFilterMap(yrs, wrds, prgrms) {
    this.refs.mapControl.filterMap(yrs, wrds, prgrms, this.setVisibleFeatures);
    this.refs.mapControl.resetMap();
  }

  handleSelectYears = (selectedOptions) => {
    this.handleSelected('years', selectedOptions)
  }

  handleSelectWards = (selectedOptions) => {
    this.handleSelected('wards', selectedOptions)
  }

  handleSelectPrograms = (selectedOptions) => {
    this.handleSelected('programs', selectedOptions)
  }

  handleSelected = (stateKey, selectedOptions) => {
    this.setState(
      { [stateKey]: selectedOptions },
      () => {
        this.triggerFilterMap(this.state.years, this.state.wards, this.state.programs)
        this.checkFiltered(this.state.years, this.state.wards, this.state.programs)
      }
    )
  }

  checkFiltered (activeYearOpts, activeWardOpts, activeProgramOpts) {
    const isFiltered = (
      activeYearOpts.length < constants.YEAR_OPTS.length ||
      activeWardOpts.length < constants.WARD_OPTS.length ||
      activeProgramOpts.length < constants.PROGRAM_OPTS.length ||
      false
    )
    this.setState({ isFiltered: isFiltered });
  }

  toggleWardLayer = () => {
    this.setState(
      prevState => ({showWardLayer: !prevState.showWardLayer}),
      () => {
        this.refs.mapControl.showWardLayer(this.state.showWardLayer)
        ReactGA.event({
          category: 'Map',
          action: 'Toggle ward layer',
          label: this.state.showWardLayer ? 'turned on' : 'turned off',
        })
      }
    )
  }

  setSortType = (sortType) => {
    // Sort the list after setting state.
    this.setState(
      { sortType: sortType },
      () => { this.sortList() }
    )
  }

  sortList = () => {
    let sortedList = [];
    switch(this.state.sortType) {
      case 'artist-asc':
      default:
        sortedList = sort(this.state.visFtrs).asc(u => u.artist)
        break
      case 'artist-desc':
        sortedList = sort(this.state.visFtrs).desc(u => u.artist)
        break
      case 'year-asc':
        sortedList = sort(this.state.visFtrs).asc(u => u.yr)
        break
      case 'year-desc':
        sortedList = sort(this.state.visFtrs).desc(u => u.yr)
        break
    }
    this.setState({visFtrs: sortedList})
  }

  handleGeolocate = () => {
    this.refs.mapControl.geolocation();
  }

  handleMapClick = (feature) => {
    ReactGA.event({
      category: 'Map',
      action: 'Clicked feature',
      label: 'ward or artwork',
    })
    if (this.state.isMobileView) {
      this.setState({
        viewType: "map",
        activeFeature: feature,
      });
    } else {
      this.setState({
        viewType: "detail",
        activeFeature: feature,
      });
    }
  }

  /**
   * Handle when a feature div in a list is clicked, storing feature data in top
   * level and moving map as appropriate.
   *
   * @param {number} featureId
   * @returns {undefined}
   */
  handleFeatureListItemClick = (featureId) => {
    let featureData = this.refs.mapControl.getFeatureById(featureId)

    this.setState({
      viewType: "detail",
      activeFeature: featureData,
    });
    this.refs.mapControl.handleFeatureClick(featureData)
  }

  handleClickBackButton = () => {
    this.setState({
      viewType: "map"
    })
  }

  setMobileFilterView = () => {
    this.setState({ viewType: "filter" });
  }

  toggleListViewMobile = () => {
    this.setState(prevState =>({
      viewType: prevState.viewType === 'list' ? 'map' : 'list'
    }))
  }

  render() {
    const {
      showSplash,
      visFtrs,
      activeFeature,
      isMobileView,
      isFiltered,
      viewType,
    } = this.state;

    const renderDesktopView = (viewType) => {
      switch (viewType) {
        default:
        case "filter":
        case "list":
          return (
            <div className="nav-wrap">
              <Logo />
              <Filters
                handleSelectYears={this.handleSelectYears}
                handleSelectWards={this.handleSelectWards}
                handleSelectPrograms={this.handleSelectPrograms}
                setSortType={this.setSortType}
                toggleWardLayer={this.toggleWardLayer}
                {...this.state}
              />
              <FeatureList
                features={visFtrs}
                onItemClick={this.handleFeatureListItemClick}
              />
            </div>
          )
        case "detail":
          return (
            <React.Fragment>
              <BackToListViewButton onClick={this.handleClickBackButton} />
              <FeatureDetail feature={activeFeature} />
            </React.Fragment>
          )
      }
    }

    const renderMobileView = (viewType) => {
      switch (viewType) {
        case "list":
          return (
            <FeatureList features={visFtrs} onItemClick={this.handleFeatureListItemClick} />
          )
        case "detail":
          return (
            <div className="detailMob">
              <Logo />
              <BackToListViewButton onClick={this.handleClickBackButton} />
              <FeatureDetail feature={activeFeature}/>
            </div>
          )
        case "filter":
          return (
            <div className="filter-wrap">
              <BackToListViewButton onClick={this.handleClickBackButton} />
              <Filters
                handleSelectYears={this.handleSelectYears}
                handleSelectWards={this.handleSelectWards}
                handleSelectPrograms={this.handleSelectPrograms}
                setSortType={this.setSortType}
                toggleWardLayer={this.toggleWardLayer}
                {...this.state}
              />
            </div>
          )
        default:
          return (
            <React.Fragment>
              <MobileMapPopup
                onClick={this.showMobileDetail}
                activeFeature={activeFeature}
              />
            </React.Fragment>
          )
      }
    }

    return (
      <div className="parent">
        { showSplash ? <Splash onButtonClick={this.closeSplash} isMobile={isMobileView} /> : null }
        <BetaBanner isMobile={isMobileView}/>
        {
          isMobileView &&
          <Header
            isMobile={isMobileView}
            isFiltered={isFiltered}
            toggleListViewMobile={this.toggleListViewMobile}
            setMobileFilterView={this.setMobileFilterView}
            viewType={viewType}
          />
        }
        <main>
          <InteractiveMap onFeatureMapClick={this.handleMapClick} ref="mapControl" />
          <GeolocateButton onClick={this.handleGeolocate}/>
          <div id="nav">
            { isMobileView ? null : renderDesktopView(viewType) }
          </div>
          { isMobileView ? renderMobileView(viewType) : null }
        </main>
      </div>
    )
  }
}
