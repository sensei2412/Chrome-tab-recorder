const states = new Map();


async function loadTabs() {

  const tabs =
    await chrome.tabs.query({});


  const container =
    document.getElementById("tabs");


  container.innerHTML = "";


  tabs
    .filter(tab =>
      tab.id &&
      tab.url &&
      !tab.url.startsWith("chrome://")
    )
    .forEach(tab => {

      const row =
        document.createElement("div");

      row.className = "tab";


      const checkbox =
        document.createElement("input");

      checkbox.type = "checkbox";

      checkbox.dataset.tabId =
        tab.id;


      const title =
        document.createElement("span");

      title.className =
        "tab-title";

      title.textContent =
        tab.title || tab.url;


      const status =
        document.createElement("span");

      status.className =
        "status";

      status.textContent =
        states.get(tab.id) || "";


      row.append(
        checkbox,
        title,
        status
      );


      container.appendChild(row);

    });

}


document
  .getElementById("recordSelected")
  .onclick = async () => {

    const selected =
      document.querySelectorAll(
        "input[type=checkbox]:checked"
      );


    for (const checkbox of selected) {

      const tabId =
        Number(
          checkbox.dataset.tabId
        );


      const tab =
        await chrome.tabs.get(tabId);


      states.set(
        tabId,
        "Recording"
      );


      chrome.runtime.sendMessage({

        type: "START_RECORDING",

        tabId,

        title:
          tab.title || `Tab ${tabId}`

      });

    }


    loadTabs();

  };


document
  .getElementById("pauseAll")
  .onclick = () => {

    states.forEach(
      (_, tabId) => {

        states.set(
          tabId,
          "Paused"
        );


        chrome.runtime.sendMessage({

          type: "PAUSE_RECORDING",

          tabId

        });

      }
    );


    loadTabs();

  };


document
  .getElementById("resumeAll")
  .onclick = () => {

    states.forEach(
      (_, tabId) => {

        states.set(
          tabId,
          "Recording"
        );


        chrome.runtime.sendMessage({

          type: "RESUME_RECORDING",

          tabId

        });

      }
    );


    loadTabs();

  };


document
  .getElementById("stopAll")
  .onclick = () => {

    states.forEach(
      (_, tabId) => {

        chrome.runtime.sendMessage({

          type: "STOP_RECORDING",

          tabId

        });

      }
    );


    states.clear();

    loadTabs();

  };


loadTabs();