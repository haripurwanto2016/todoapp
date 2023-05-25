<script>
	import CardList from "./CardList.svelte";

	export let name;

	let taskCardsLocalStorage = JSON.parse(localStorage.getItem("taskCards"));
	let inProgressCardsLocalStorage = JSON.parse(
		localStorage.getItem("inProgressCards")
	);
	let doneCardsLocalStorage = JSON.parse(localStorage.getItem("doneCards"));

	let taskCards = taskCardsLocalStorage ? taskCardsLocalStorage : [];
	let inProgressCards = inProgressCardsLocalStorage
		? inProgressCardsLocalStorage
		: [];
	let doneCards = doneCardsLocalStorage ? doneCardsLocalStorage : [];

	function handleEventAddCard(event) {
		let data = event.detail;
		if (data.listName == "Girls") {
			taskCards = [...taskCards, { todo: data.todo }];
			localStorage.setItem("taskCards", JSON.stringify(taskCards));
		} else if (data.listName == "Girlfriends") {
			inProgressCards = [...inProgressCards, { todo: data.todo }];
			localStorage.setItem(
				"inProgressCards",
				JSON.stringify(inProgressCards)
			);
		} else {
			doneCards = [...doneCards, { todo: data.todo }];
			localStorage.setItem("doneCards", JSON.stringify(doneCards));
		}
	}

	function handleEventDeleteCard(event) {
		let data = event.detail;

		if (data.listName == "Girls") {
			taskCards.splice(data.index, 1);
			taskCards = taskCards;
			localStorage.setItem("taskCards", JSON.stringify(taskCards));
		} else if (data.listName == "Girlfriends") {
			inProgressCards.splice(data.index, 1);
			inProgressCards = inProgressCards;
			localStorage.setItem(
				"inProgressCards",
				JSON.stringify(inProgressCards)
			);
		} else {
			doneCards.splice(data.index, 1);
			doneCards = doneCards;
			localStorage.setItem("doneCards", JSON.stringify(doneCards));
		}
	}

	function handleEventMoveRight(event) {
		let data = event.detail;

		if (data.listName == "Girls") {
			let cardToMove = taskCards.splice(data.index, 1);
			inProgressCards = [...inProgressCards, cardToMove[0]];
			taskCards = taskCards;
			localStorage.setItem("taskCards", JSON.stringify(taskCards));
			localStorage.setItem(
				"inProgressCards",
				JSON.stringify(inProgressCards)
			);
		} else if (data.listName == "Girlfriends") {
			let cardToMove = inProgressCards.splice(data.index, 1);
			doneCards = [...doneCards, cardToMove[0]];
			inProgressCards = inProgressCards;
			localStorage.setItem(
				"inProgressCards",
				JSON.stringify(inProgressCards)
			);
			localStorage.setItem("doneCards", JSON.stringify(doneCards));
		}
	}

	function handleEventMoveLeft(event) {
		let data = event.detail;

		if (data.listName == "Girlfriends") {
			let cardToMove = inProgressCards.splice(data.index, 1);
			taskCards = [...taskCards, cardToMove[0]];
			inProgressCards = inProgressCards;
			localStorage.setItem("taskCards", JSON.stringify(taskCards));
			localStorage.setItem(
				"inProgressCards",
				JSON.stringify(inProgressCards)
			);
		} else if (data.listName == "Wives") {
			let cardToMove = doneCards.splice(data.index, 1);
			inProgressCards = [...inProgressCards, cardToMove[0]];
			doneCards = doneCards;
			localStorage.setItem(
				"inProgressCards",
				JSON.stringify(inProgressCards)
			);
			localStorage.setItem("doneCards", JSON.stringify(doneCards));
		}
	}
</script>

<div class="container is-fluid">
	<h1>Hello {name}!</h1>
	<h1 class="is-size-2">Select App</h1>
	<div class="columns">
		<CardList
			cards={taskCards}
			listName={"Girls"}
			on:addCard={handleEventAddCard}
			on:deleteCard={handleEventDeleteCard}
			on:moveRight={handleEventMoveRight}
		/>
		<CardList
			cards={inProgressCards}
			listName={"Girlfriends"}
			on:addCard={handleEventAddCard}
			on:deleteCard={handleEventDeleteCard}
			on:moveRight={handleEventMoveRight}
			on:moveLeft={handleEventMoveLeft}
		/>
		<CardList
			cards={doneCards}
			listName={"Wives"}
			on:addCard={handleEventAddCard}
			on:deleteCard={handleEventDeleteCard}
			on:moveLeft={handleEventMoveLeft}
		/>
	</div>
</div>
<svelte:head>
	<link rel="stylesheet" href="../build/bulma.min.css" />
	<link
		rel="stylesheet"
		href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.2.1/css/fontawesome.min.css"
		integrity="sha384-QYIZto+st3yW+o8+5OHfT6S482Zsvz2WfOzpFSXMF9zqeLcFV0/wlZpMtyFcZALm"
		crossorigin="anonymous"
	/>
</svelte:head>
