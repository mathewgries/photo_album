import React, { Component } from 'react'
import { BrowserRouter as Router, Route, NavLink } from 'react-router-dom'
import { Connect } from 'aws-amplify-react'
import Amplify, { API, graphqlOperation, Storage } from 'aws-amplify'
import { v4 as uuid } from 'uuid'
import { Form, Grid, Header, Input, List, Segment } from 'semantic-ui-react'
import aws_exports from './aws-exports'
import { withAuthenticator } from 'aws-amplify-react'
Amplify.configure(aws_exports)

// Query Strings for GraphQL API
const ListAlbums = `query ListAlbums {
	listAlbums(limit: 9999) {
		items {
			id
			name
		}
	}
}`

const SubscribeToNewAlbums = `
	subscription OnCreateAlbum {
		onCreateAlbum {
			id
			name
		}
	}
`

const GetAlbum = `query GetALbum($id: ID!){
	getAlbum(id: $id){
		id
		name
	}
}
`

function makeComparator(key, order = 'asc') {
	return (a, b) => {
		if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) return 0

		const aVal = (typeof a[key] === 'string') ? a[key].toUpperCase() : a[key]
		const bVal = (typeof b[key] === 'string') ? b[key].toUpperCase() : b[key]

		let comparison = 0
		if (aVal > bVal) comparison = 1
		if (aVal < bVal) comparison = -1

		return order === 'desc' ? (comparison * -1) : comparison
	}
}

class S3ImageUpload extends React.Component {
	constructor(props) {
		super(props)
		this.state = { uploading: false, }
	}

	onChange = async (e) => {
		const file = e.target.files[0]
		const filename = uuid()

		this.setState({ uploading: true })

		const result = await Storage.put(
			filename,
			file,
			{
				customPrefix: { public: 'uploads/' },
				metadata: { albumId: this.props.albumId }
			}
		)

		console.log('Upload file: ', result)
		this.setState({ uploading: false })
	}

	render() {
		return (
			<div>
				<Form.Button
					onClick={() => document.getElementById('add-image-file-input').click()}
					disabled={this.state.uploading}
					icon='file image outline'
					content={this.state.uploading ? 'Uploading...' : 'Add image'}
				/>
				<Input
					id='add-image-file-input'
					type='file'
					accept='image/*'
					onChange={this.onChange}
					style={{ display: 'none' }}
				/>
			</div>
		)
	}
}

class NewAlbum extends React.Component {
	constructor(props) {
		super(props)
		this.state = {
			albumName: '',
		}
	}

	handleChange = (event) => {
		let change = {};
		change[event.target.name] = event.target.value
		this.setState(change)
	}

	handleSubmit = async (event) => {
		event.preventDefault()
		const NewAlbum = `mutation NewAlbum($name: String!) {
			createAlbum(input: {name: $name}){
				id
				name
			}
		}`

		const result = await API.graphql(graphqlOperation(NewAlbum, {
			name: this.state.albumName
		}))

		console.info(`Created album with id ${result.data.createAlbum.id}`)
	}

	render() {
		return (
			<Segment>
				<Header as='h3'>Add a New Album</Header>
				<Input
					type='text'
					placeholder='New Album Name...'
					icon='plus'
					iconPosition='left'
					action={{ content: 'Create', onClick: this.handleSubmit }}
					name='albumName'
					value={this.state.albumName}
					onChange={this.handleChange}
				/>
			</Segment>

		)
	}
}

class AlbumList extends React.Component {

	albumItems() {
		return this.props.albums.sort(makeComparator('name'))
			.map(album => {
				return (
					<List.Item key={album.id}>
						<NavLink to={`/albums/${album.id}`}>{album.name}</NavLink>
					</List.Item>
				)
			})
	}

	render() {
		console.log(this.props.albums)
		return (
			<Segment>
				<Header as='h3'>My Albums</Header>
				<List divided relaxed>
					{this.albumItems()}
				</List>
			</Segment>
		)
	}
}

class AlbumsListLoader extends React.Component {

	onNewAlbum = (prevQuery, newData) => {
		// When we get data about a new album
		// we need to put it into an object
		// with the same shape as the original qeury results,
		// but with the new data added as well
		let updateQuery = Object.assign({}, prevQuery)
		updateQuery.listAlbums.items = prevQuery.listAlbums.items.concat([newData.onCreateAlbum])
		return updateQuery
	}

	render() {
		return (
			<Connect
				query={graphqlOperation(ListAlbums)}
				subscription={graphqlOperation(SubscribeToNewAlbums)}
				onSubscriptionMsg={this.onNewAlbum}>
				{({ data, loading, errors }) => {
					if (loading) { return <div>Loading...</div> }
					if (!data.listAlbums) return
					console.log(data)

					return <AlbumList albums={data.listAlbums.items} />
				}}
			</Connect>
		)
	}
}

class AlbumDetailsLoader extends React.Component {
	render() {
		return (
			<Connect query={graphqlOperation(GetAlbum, { id: this.props.id })}>
				{({ data, loading, errors }) => {
					if (loading) return <div>Loading...</div>
					if (errors.length > 0) {
						return <pre>{JSON.stringify(errors, null, 2)}</pre>
					}
					if (!data.getAlbum) return

					return <AlbumDetails album={data.getAlbum} />
				}}
			</Connect>
		)
	}
}

class AlbumDetails extends React.Component {
	render() {
		return (
			<Segment>
				<Header as='h3'>{this.props.album.name}</Header>
				<S3ImageUpload albumId={this.props.album.id} />
				<p>TODO: Show photos for this album</p>
			</Segment>

		)
	}
}


class App extends Component {
	render() {
		return (
			<Router>
				<Grid padded>
					<Grid.Column>
						<Route path='/' exact component={NewAlbum} />
						<Route path='/' exact component={AlbumsListLoader} />
						<Route path='/albums/:albumId' render={() => {
							return <div><NavLink to='/'>Back to Albums</NavLink></div>
						}} />
						<Route path='/albums/:albumId' render={(props) => {
							return <AlbumDetailsLoader id={props.match.params.albumId} />
						}} />
					</Grid.Column>

				</Grid>
			</Router>
		);
	}
}

export default withAuthenticator(App, { includeGreetings: true })